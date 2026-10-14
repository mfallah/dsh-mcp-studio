/**
 * MCP Studio host service: the one object the browser panel talks to.
 *
 * It implements `McpStudioApi` from the frozen shared contract and owns no
 * transport of its own — `src/host/http.ts` dispatches method names onto it.
 * Every method returns plain JSON and throws `McpStudioError` with a stable
 * `code` for anything the user can act on.
 *
 * @module @mfallah/dsh-mcp-studio/host/service
 */
import type {
  CatalogEntry,
  CatalogPage,
  CatalogQuery,
  LogChunk,
  McpStudioApi,
  ProbeResult,
  ResolutionReport,
  RuntimeReport,
  ServerConfig,
  ServerDetail,
  ServerDraft,
  ServerPatch,
  ServerView,
  StdioServer,
  HttpServer,
} from '../shared/contract.js'
import {
  SERVER_NAME_RE,
  describeTarget,
  slugifyServerName,
} from '../shared/contract.js'
import type { ConnectionSupervisor } from './connection.js'
import { describeConfig } from './connection.js'
import type { CatalogService } from './catalog.js'
import { detectRuntimes } from './detect.js'
import type { LogBuffer } from './logs.js'
import { entryToDraft, validateCatalogValues } from './install-template.js'
import {
  describeMissing,
  redactMap,
  resolveMap,
  secretNamesIn,
  usesSecrets,
} from './resolve.js'
import type { SecretStore } from './secrets.js'
import type { ServerStore } from './store.js'

/** An error with a stable machine-readable code the UI can branch on. */
export class McpStudioError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'McpStudioError'
    this.code = code
  }
}

/** Everything the service needs, all injected so tests can substitute. */
export interface ServiceDeps {
  store: ServerStore
  secrets: SecretStore
  logs: LogBuffer
  catalog: CatalogService
  supervisor: ConnectionSupervisor
  env: NodeJS.ProcessEnv
  /** Budget for a pre-save connection probe. */
  probeTimeoutMs: number
  /** Reports a state change to the plugin's event emitter. */
  onChange: (ids: string[], reason: 'added' | 'updated' | 'removed' | 'status') => void
  /** Package version, reported by the export header. */
  version: string
}

const DEFAULT_TOOL_TIMEOUT_MS = 60_000

/** Trim, collapse whitespace, and cap a user-supplied string. */
function clean(value: unknown, max = 200): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, max)
}

/** Coerce a draft's string list, dropping blanks. */
function stringList(value: unknown, max = 64): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, max)
}

/** Coerce a draft's string map, dropping blank keys. */
function stringMap(value: unknown, max = 64): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  let count = 0
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const name = key.trim()
    if (name.length === 0) continue
    if (count >= max) break
    out[name] = typeof raw === 'string' ? raw : String(raw ?? '')
    count += 1
  }
  return out
}

/** Validate an id grammar so a crafted id can never escape the store. */
function assertId(id: unknown): string {
  const value = typeof id === 'string' ? id.trim() : ''
  if (!/^[A-Za-z0-9_-]{1,48}$/.test(value)) {
    throw new McpStudioError('invalid-id', `"${String(id)}" is not a valid server id`)
  }
  return value
}

/**
 * The MCP Studio host service.
 *
 * Not a Cordis service: it is created by the plugin and handed to the HTTP
 * dispatcher directly. Keeping it a plain class means every method is unit
 * testable without a Cordis runtime.
 */
export class McpStudioService implements McpStudioApi {
  private readonly deps: ServiceDeps
  private runtimeCache: RuntimeReport | null = null

  constructor(deps: ServiceDeps) {
    this.deps = deps
  }

  // -- helpers ---------------------------------------------------------------

  private requireConfig(id: unknown): ServerConfig {
    const key = assertId(id)
    const config = this.deps.store.get(key)
    if (config === undefined) {
      throw new McpStudioError('not-found', `no MCP server with id "${key}"`)
    }
    return config
  }

  private view(config: ServerConfig): ServerView {
    const state = this.deps.supervisor.state(config.id)
    const tools = state?.status === 'connected' ? this.deps.supervisor.refreshTools(config.id) : (state?.tools ?? [])
    const envLike = config.transport === 'stdio' ? config.env : config.headers
    const names = secretNamesIn(envLike)
    const view: ServerView = {
      ...config,
      status: this.deps.supervisor.status(config),
      tools,
      toolCount: tools.length,
      target: describeTarget(config),
      secretKeys: names,
      usesSecrets: usesSecrets(envLike),
    }
    if (state?.lastError !== undefined) view.lastError = state.lastError
    if (state?.connectedAt !== undefined) view.connectedAt = state.connectedAt
    return view
  }

  /** Turn a validated draft into a persistable config. */
  private draftToConfig(
    draft: ServerDraft,
    options: { id?: string; existing?: ServerConfig },
  ): ServerConfig {
    const title = clean(draft.title, 120)
    if (title.length === 0) {
      throw new McpStudioError('invalid-title', 'a display title is required')
    }
    const transport = draft.transport === 'streamable-http' ? 'streamable-http' : 'stdio'
    const requested =
      clean(draft.serverName ?? '', 32) ||
      (options.existing?.serverName ?? '') ||
      slugifyServerName(title)
    if (!SERVER_NAME_RE.test(requested)) {
      throw new McpStudioError(
        'invalid-server-name',
        `server name "${requested}" must match ${String(SERVER_NAME_RE)}`,
      )
    }
    const clash = this.deps.store.findByName(requested)
    if (clash !== undefined && clash.id !== options.id) {
      throw new McpStudioError(
        'duplicate-server-name',
        `server name "${requested}" is already used by "${clash.title}"`,
      )
    }

    const now = new Date().toISOString()
    const base = {
      id: options.id ?? requested.toLowerCase(),
      serverName: requested,
      title,
      description: clean(draft.description, 600) || undefined,
      enabled: options.existing?.enabled ?? true,
      source: options.existing?.source ?? ('custom' as const),
      catalogId: options.existing?.catalogId,
      homepage: options.existing?.homepage,
      failOnStartupError: draft.failOnStartupError ?? options.existing?.failOnStartupError ?? false,
      toolCallTimeoutMs:
        typeof draft.toolCallTimeoutMs === 'number' && draft.toolCallTimeoutMs > 0
          ? Math.min(draft.toolCallTimeoutMs, 600_000)
          : (options.existing?.toolCallTimeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS),
      createdAt: options.existing?.createdAt ?? now,
      updatedAt: now,
    }

    if (transport === 'streamable-http') {
      const url = clean(draft.url ?? (options.existing?.transport === 'streamable-http' ? options.existing.url : ''), 2000)
      if (!/^https?:\/\//i.test(url)) {
        throw new McpStudioError('invalid-url', 'an http(s) endpoint URL is required')
      }
      const config: HttpServer = {
        ...base,
        transport: 'streamable-http',
        url,
        headers: stringMap(draft.headers ?? (options.existing?.transport === 'streamable-http' ? options.existing.headers : {})),
      }
      return config
    }

    const command = clean(draft.command ?? (options.existing?.transport === 'stdio' ? options.existing.command : ''), 400)
    if (command.length === 0) {
      throw new McpStudioError('invalid-command', 'a command is required for a stdio server')
    }
    const config: StdioServer = {
      ...base,
      transport: 'stdio',
      command,
      args: stringList(draft.args ?? (options.existing?.transport === 'stdio' ? options.existing.args : [])),
      env: stringMap(draft.env ?? (options.existing?.transport === 'stdio' ? options.existing.env : {})),
      cwd: clean(draft.cwd ?? (options.existing?.transport === 'stdio' ? (options.existing.cwd ?? '') : ''), 1000) || undefined,
    }
    return config
  }

  /** Build a config for a draft without persisting it, for probes. */
  private draftToProbeConfig(draft: ServerDraft): ServerConfig {
    const clashFree = { ...draft }
    const requested = clean(draft.serverName ?? '', 32) || slugifyServerName(clean(draft.title, 120) || 'probe')
    clashFree.serverName = requested
    const id = `probe${Math.random().toString(36).slice(2, 8)}`
    const provisional = this.draftToConfig(clashFree, { id })
    return provisional
  }

  // -- servers ---------------------------------------------------------------

  async listServers(): Promise<ServerView[]> {
    return this.deps.store
      .list()
      .map((config) => this.view(config))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async getServer(id: string): Promise<ServerDetail | null> {
    const config = this.deps.store.get(assertId(id))
    if (config === undefined) return null
    const view = this.view(config)
    return { ...view, config, logs: this.deps.logs.tail(config.id, 0).entries }
  }

  async addServer(draft: ServerDraft): Promise<ServerView> {
    const config = this.draftToConfig(draft, {})
    await this.deps.store.upsert(config)
    this.deps.logs.append(config.id, 'info', `added ${describeConfig(config)}`)
    if (config.enabled) await this.deps.supervisor.mount(config)
    this.deps.onChange([config.id], 'added')
    return this.view(config)
  }

  async updateServer(id: string, patch: ServerPatch): Promise<ServerView> {
    const existing = this.requireConfig(id)
    const merged: ServerDraft = {
      transport: existing.transport,
      title: patch.title ?? existing.title,
      description: patch.description ?? existing.description,
      serverName: patch.serverName ?? existing.serverName,
      command: patch.command ?? (existing.transport === 'stdio' ? existing.command : undefined),
      args: patch.args ?? (existing.transport === 'stdio' ? existing.args : undefined),
      env: patch.env ?? (existing.transport === 'stdio' ? existing.env : undefined),
      cwd: patch.cwd ?? (existing.transport === 'stdio' ? existing.cwd : undefined),
      url: patch.url ?? (existing.transport === 'streamable-http' ? existing.url : undefined),
      headers: patch.headers ?? (existing.transport === 'streamable-http' ? existing.headers : undefined),
      failOnStartupError: patch.failOnStartupError ?? existing.failOnStartupError,
      toolCallTimeoutMs: patch.toolCallTimeoutMs ?? existing.toolCallTimeoutMs,
    }
    const next = this.draftToConfig(merged, { id: existing.id, existing })
    if (patch.enabled !== undefined) next.enabled = patch.enabled
    await this.deps.store.upsert(next)
    if (next.enabled) await this.deps.supervisor.mount(next)
    else await this.deps.supervisor.unmount(next.id)
    this.deps.onChange([next.id], 'updated')
    return this.view(next)
  }

  async removeServer(id: string): Promise<void> {
    const config = this.requireConfig(id)
    await this.deps.supervisor.unmount(config.id)
    await this.deps.store.remove(config.id)
    this.deps.logs.clear(config.id)
    for (const name of secretNamesIn(config.transport === 'stdio' ? config.env : config.headers)) {
      if (this.referencesTo(name).length === 0) await this.deps.secrets.delete(name)
    }
    this.deps.onChange([config.id], 'removed')
  }

  async setEnabled(id: string, enabled: boolean): Promise<ServerView> {
    const config = this.requireConfig(id)
    const next: ServerConfig = { ...config, enabled, updatedAt: new Date().toISOString() }
    await this.deps.store.upsert(next)
    if (enabled) await this.deps.supervisor.mount(next)
    else await this.deps.supervisor.unmount(next.id)
    this.deps.onChange([next.id], 'updated')
    return this.view(next)
  }

  async restartServer(id: string): Promise<ServerView> {
    const config = this.requireConfig(id)
    await this.deps.supervisor.restart(config)
    this.deps.onChange([config.id], 'status')
    return this.view(config)
  }

  async testConnection(draft: ServerDraft): Promise<ProbeResult> {
    const started = Date.now()
    let config: ServerConfig
    try {
      config = this.draftToProbeConfig(draft)
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        code: 'invalid-config',
        durationMs: Date.now() - started,
      }
    }
    /**
     * A first `npx -y <pkg>` has to download the package before it can answer,
     * which routinely takes tens of seconds on a cold cache. The probe budget
     * therefore comes from config rather than from the per-call timeout, whose
     * much smaller default would report a healthy server as unreachable.
     */
    const timeoutMs = this.deps.probeTimeoutMs
    const result = await this.deps.supervisor.probe(config, timeoutMs)
    const probe: ProbeResult = {
      ok: result.ok,
      durationMs: Date.now() - started,
      tools: result.tools,
    }
    if (result.error !== undefined) {
      probe.error = result.error
      probe.code = classifyProbeError(result.error)
    }
    return probe
  }

  async getLogs(id: string, sinceSeq: number): Promise<LogChunk> {
    const key = assertId(id)
    return this.deps.logs.tail(key, Number.isFinite(sinceSeq) ? sinceSeq : 0)
  }

  // -- catalog ---------------------------------------------------------------

  async catalog(query: CatalogQuery): Promise<CatalogPage> {
    return await this.deps.catalog.search(query)
  }

  async catalogCategories(): Promise<string[]> {
    return await this.deps.catalog.categories()
  }

  /** Turn a catalog entry plus filled values into an installable draft. */
  async installFromCatalog(catalogId: string, values: Record<string, string>): Promise<ServerDraft> {
    const entry = this.catalogEntrySync(catalogId)
    const errors = validateCatalogValues(entry, values)
    const first = Object.values(errors)[0]
    if (first !== undefined) throw new McpStudioError('invalid-input', first)
    return entryToDraft(entry, values)
  }

  private catalogEntrySync(catalogId: string): CatalogEntry {
    const entry = this.deps.catalog.findById(catalogId)
    if (entry === undefined) {
      throw new McpStudioError('not-found', `no catalog entry with id "${catalogId}"`)
    }
    return entry
  }

  // -- environment, secrets, diagnostics ------------------------------------

  async detectRuntimes(): Promise<RuntimeReport> {
    if (this.runtimeCache === null) {
      this.runtimeCache = await detectRuntimes({ env: this.deps.env })
    }
    return this.runtimeCache
  }

  async listSecretNames(): Promise<string[]> {
    return this.deps.secrets.names()
  }

  async setSecret(name: string, value: string): Promise<void> {
    const key = clean(name, 64)
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(key)) {
      throw new McpStudioError('invalid-secret-name', 'secret names use letters, digits, dot, dash and underscore')
    }
    if (typeof value !== 'string' || value.length === 0) {
      throw new McpStudioError('invalid-secret-value', 'a non-empty secret value is required')
    }
    await this.deps.secrets.set(key, value)
  }

  async deleteSecret(name: string): Promise<void> {
    const key = clean(name, 64)
    const users = this.referencesTo(key)
    if (users.length > 0) {
      throw new McpStudioError(
        'secret-in-use',
        `"${key}" is still used by ${users.map((config) => `"${config.title}"`).join(', ')}`,
      )
    }
    await this.deps.secrets.delete(key)
  }

  async resolveConfig(draft: ServerDraft): Promise<ResolutionReport> {
    const map = draft.transport === 'stdio' ? draft.env : draft.headers
    return resolveMap(stringMap(map), { env: this.deps.env, secrets: this.deps.secrets }).report
  }

  async exportPatch(): Promise<string> {
    const lines: string[] = [
      `# Generated by @mfallah/dsh-mcp-studio v${this.deps.version}`,
      '# Append this layer to <profile>/cordis.patch.yml to load these servers',
      '# without the plugin. Secret references are preserved, not expanded.',
      '',
    ]
    for (const config of this.deps.store.list()) {
      lines.push('- insert:')
      lines.push(`    - id: mcp-${config.id}`)
      lines.push(`      name: '@deepseek-ai/dsh-mcp-client'`)
      lines.push('      config:')
      lines.push(`        serverName: ${config.serverName}`)
      lines.push(`        transport: ${config.transport}`)
      if (config.transport === 'stdio') {
        lines.push(`        command: ${JSON.stringify(config.command)}`)
        lines.push(`        args: ${JSON.stringify(config.args)}`)
        if (Object.keys(config.env).length > 0) {
          lines.push('        env:')
          for (const [key, value] of Object.entries(config.env)) {
            lines.push(`          ${key}: ${JSON.stringify(value)}`)
          }
        }
        if (config.cwd !== undefined) lines.push(`        cwd: ${JSON.stringify(config.cwd)}`)
      } else {
        lines.push(`        url: ${JSON.stringify(config.url)}`)
        if (Object.keys(config.headers).length > 0) {
          lines.push('        headers:')
          for (const [key, value] of Object.entries(config.headers)) {
            lines.push(`          ${key}: ${JSON.stringify(value)}`)
          }
        }
      }
      lines.push(`        toolCallTimeoutMs: ${config.toolCallTimeoutMs}`)
      lines.push(`        failOnStartupError: ${String(config.failOnStartupError)}`)
      lines.push('')
    }
    return lines.join('\n')
  }

  // -- plugin-internal helpers ----------------------------------------------

  /** Configs whose env/headers reference one secret name. */
  referencesTo(name: string): ServerConfig[] {
    return this.deps.store.list().filter((config) => {
      const map = config.transport === 'stdio' ? config.env : config.headers
      return secretNamesIn(map).includes(name)
    })
  }

  /** Mount every enabled server; used once at plugin startup. */
  async mountAll(): Promise<void> {
    const configs = this.deps.store.list().filter((config) => config.enabled)
    await Promise.all(configs.map((config) => this.deps.supervisor.mount(config).catch(() => undefined)))
  }

  /** Redacted env/header map for a server, for the settings pane. */
  redacted(config: ServerConfig): Record<string, string> {
    return redactMap(config.transport === 'stdio' ? config.env : config.headers)
  }

  /** One-line reason a config would fail to connect right now, or '' when fine. */
  precondition(config: ServerConfig): string {
    const map = config.transport === 'stdio' ? config.env : config.headers
    const report = resolveMap(map, { env: this.deps.env, secrets: this.deps.secrets }).report
    return report.ok ? '' : describeMissing(report)
  }
}

/** Map a raw probe failure onto the contract's failure classes. */
function classifyProbeError(message: string): ProbeResult['code'] {
  const text = message.toLowerCase()
  if (text.includes('enoent') || text.includes('not found') || text.includes('not recognized')) {
    return 'command-missing'
  }
  if (text.includes('timed out') || text.includes('timeout')) return 'timeout'
  if (text.includes('http') || text.includes('fetch') || text.includes('econnrefused')) return 'http-error'
  if (text.includes('bridge-missing') || text.includes('spawn')) return 'spawn-failed'
  return 'handshake-failed'
}
