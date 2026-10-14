/**
 * Connection supervisor: one live MCP client instance per enabled server.
 *
 * The harness ships `@deepseek-ai/dsh-mcp-client` as a Cordis plugin whose
 * `apply(ctx, config)` connects one server and publishes its tools under
 * `mcp__<serverName>__<tool>`. The shipped way to use it is one row per server
 * in `cordis.patch.yml`. This supervisor does the same thing at runtime instead:
 * it loads the bridge dynamically and mounts one child plugin per configured
 * server, so adding a server from the UI needs no file edit and no restart.
 *
 * Consequences of that choice, all deliberate:
 * - A server's lifetime is the child fiber's lifetime. Disabling or deleting a
 *   server disposes the fiber, which disconnects the transport and unregisters
 *   the tools. That is the bridge's own documented disposal contract, not
 *   something reimplemented here.
 * - `failOnStartupError` is always `true` for a mount driven by this plugin, so
 *   a broken server surfaces as a rejected promise we can attribute to one row
 *   instead of a silent absence of tools. The user-facing default is still
 *   "keep the harness running": the failure is caught here and turned into the
 *   row's `error` status.
 * - The bridge is imported lazily. If it is missing, MCP Studio still loads and
 *   says so, instead of taking the whole harness down with it.
 *
 * @module @mfallah/dsh-mcp-studio/host/connection
 */
import type { Context, Fiber } from '@deepseek-ai/cordis'
import type { ServerConfig, ServerStatus } from '../shared/contract.js'
import type { LogBuffer } from './logs.js'
import { describeMissing, resolveMap, type ResolveContext } from './resolve.js'

/** The slice of `ctx.tools` this supervisor reads. Structural, so no hard dep. */
export interface ToolSchemaSource {
  schemas(scope?: unknown): Array<{ name: string }>
}

/** Live state of one server, owned by the supervisor. */
export interface MountedState {
  config: ServerConfig
  fiber: Fiber | null
  status: ServerStatus
  lastError?: string
  connectedAt?: string
  /** Raw tool names discovered under this server's namespace. */
  tools: string[]
}

export interface SupervisorOptions {
  ctx: Context
  logs: LogBuffer
  resolve: ResolveContext
  /** Reads the live tool registry; `undefined` until the tools service appears. */
  tools: () => ToolSchemaSource | undefined
  /** Called after any status change so the plugin can notify the UI. */
  onChange: (id: string) => void
  /** Extra time allowed for one mount attempt beyond the per-call timeout. */
  mountTimeoutMs?: number
}

/** Error code used when the MCP bridge package itself cannot be loaded. */
export class BridgeMissingError extends Error {
  readonly code = 'bridge-missing'
  constructor(cause: unknown) {
    super(
      'the MCP client bridge (@deepseek-ai/dsh-mcp-client) is not installed in this profile; ' +
        'run "dsh plugin --profile web add @deepseek-ai/dsh-mcp-client" and reload',
      { cause },
    )
    this.name = 'BridgeMissingError'
  }
}

/** Error code used when a config still has unresolved placeholders. */
export class UnresolvedConfigError extends Error {
  readonly code = 'unresolved-config'
  constructor(message: string) {
    super(message)
    this.name = 'UnresolvedConfigError'
  }
}

/** Reject after `ms`, carrying a message that names the operation. */
function withTimeout<T>(thenable: PromiseLike<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms}ms`)), ms)
    thenable.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

/**
 * Turn any thrown value into a one-line message worth showing a user.
 *
 * The bridge wraps the real cause in a generic "initial connection or tool
 * synchronization failed" error, so the chain is walked and joined. Without
 * this a missing executable reads as an unexplained failure, and the UI cannot
 * tell the user which command to install.
 */
export function errorMessage(error: unknown): string {
  const parts: string[] = []
  let current: unknown = error
  for (let depth = 0; depth < 5 && current !== undefined && current !== null; depth += 1) {
    const text = current instanceof Error ? current.message : String(current)
    if (text.length > 0 && !parts.includes(text)) parts.push(text)
    current = current instanceof Error ? (current as { cause?: unknown }).cause : undefined
  }
  return parts.length > 0 ? parts.join(': ') : 'unknown error'
}

/** The shape `@deepseek-ai/dsh-mcp-client` accepts, built from a stored config. */
type BridgeConfig =
  | {
      transport: 'stdio'
      serverName: string
      command: string
      args: string[]
      env: Record<string, string>
      cwd: string
      toolCallTimeoutMs: number
      failOnStartupError: boolean
    }
  | {
      transport: 'streamable-http'
      serverName: string
      url: string
      headers: Record<string, string>
      toolCallTimeoutMs: number
      failOnStartupError: boolean
    }

/** Minimal structural type of the bridge module we mount. */
interface BridgeModule {
  name?: string
  inject?: string[]
  Config?: unknown
  apply: (ctx: Context, config: BridgeConfig) => unknown
}

/**
 * Owns the live connection of every configured MCP server.
 *
 * One instance per plugin load. It holds no persistence — the store does — and
 * never edits configuration. Every public method is safe to call concurrently:
 * mounting the same id twice serializes through an internal per-id chain.
 */
export class ConnectionSupervisor {
  private readonly ctx: Context
  private readonly logs: LogBuffer
  private readonly resolve: ResolveContext
  private readonly tools: () => ToolSchemaSource | undefined
  private readonly onChange: (id: string) => void
  private readonly mountTimeoutMs: number
  private readonly states = new Map<string, MountedState>()
  /** Serializes mount/unmount per server id, so two UI clicks cannot race. */
  private readonly chains = new Map<string, Promise<unknown>>()
  private bridge: BridgeModule | null = null
  private disposed = false

  constructor(options: SupervisorOptions) {
    this.ctx = options.ctx
    this.logs = options.logs
    this.resolve = options.resolve
    this.tools = options.tools
    this.onChange = options.onChange
    this.mountTimeoutMs = options.mountTimeoutMs ?? 30_000
  }

  /** Run `work` after every previously queued operation for `id`. */
  private serialize<T>(id: string, work: () => Promise<T>): Promise<T> {
    const previous = this.chains.get(id) ?? Promise.resolve()
    const next = previous.then(work, work)
    this.chains.set(
      id,
      next.then(
        () => undefined,
        () => undefined,
      ),
    )
    return next
  }

  /** Live state for one server, or `undefined` when it was never mounted. */
  state(id: string): MountedState | undefined {
    return this.states.get(id)
  }

  /** Status for a config row: a disabled row never has a live state. */
  status(config: ServerConfig): ServerStatus {
    if (!config.enabled) return 'disabled'
    return this.states.get(config.id)?.status ?? 'stopped'
  }

  /** Raw tool names discovered under one server namespace. */
  toolsFor(serverName: string): string[] {
    const prefix = `mcp__${serverName}__`
    const registry = this.tools()
    if (registry === undefined) return []
    try {
      return registry
        .schemas()
        .map((schema) => schema.name)
        .filter((name) => name.startsWith(prefix))
        .map((name) => name.slice(prefix.length))
        .sort()
    } catch {
      return []
    }
  }

  /** Load the bridge module once; throws {@link BridgeMissingError} when absent. */
  private async loadBridge(): Promise<BridgeModule> {
    if (this.bridge !== null) return this.bridge
    let module: unknown
    try {
      module = await import('@deepseek-ai/dsh-mcp-client')
    } catch (error) {
      throw new BridgeMissingError(error)
    }
    const candidate = module as Partial<BridgeModule>
    if (typeof candidate.apply !== 'function') {
      throw new BridgeMissingError(new Error('module has no apply() export'))
    }
    const bridge: BridgeModule = {
      apply: candidate.apply.bind(module),
      ...(candidate.name === undefined ? {} : { name: candidate.name }),
      ...(candidate.inject === undefined ? {} : { inject: candidate.inject }),
      ...(candidate.Config === undefined ? {} : { Config: candidate.Config }),
    }
    this.bridge = bridge
    return bridge
  }

  /** Build the bridge config, expanding placeholders and reporting misses. */
  private bridgeConfig(config: ServerConfig, serverName: string): BridgeConfig {
    if (config.transport === 'stdio') {
      const resolved = resolveMap(config.env, this.resolve)
      if (!resolved.report.ok) {
        throw new UnresolvedConfigError(
          `server "${config.title}" cannot connect: ${describeMissing(resolved.report)}`,
        )
      }
      return {
        transport: 'stdio',
        serverName,
        command: config.command,
        args: [...config.args],
        env: resolved.values,
        cwd: config.cwd ?? process.cwd(),
        toolCallTimeoutMs: config.toolCallTimeoutMs,
        failOnStartupError: true,
      }
    }
    const resolved = resolveMap(config.headers, this.resolve)
    if (!resolved.report.ok) {
      throw new UnresolvedConfigError(
        `server "${config.title}" cannot connect: ${describeMissing(resolved.report)}`,
      )
    }
    return {
      transport: 'streamable-http',
      serverName,
      url: config.url,
      headers: resolved.values,
      toolCallTimeoutMs: config.toolCallTimeoutMs,
      failOnStartupError: true,
    }
  }

  /**
   * Mount one server. Idempotent per id: mounting again replaces the previous
   * instance after disposing it. Never throws for a server-side failure — the
   * failure is recorded on the returned state.
   * @param config - the persisted server row.
   * @returns the resulting live state.
   */
  mount(config: ServerConfig): Promise<MountedState> {
    return this.serialize(config.id, async () => {
      if (this.disposed) return this.disabledState(config, 'plugin is unloading')
      await this.unmountNow(config.id)
      const state: MountedState = {
        config,
        fiber: null,
        status: config.enabled ? 'connecting' : 'disabled',
        tools: [],
      }
      this.states.set(config.id, state)
      this.onChange(config.id)
      if (!config.enabled) return state
      return this.connect(state)
    })
  }

  /** Establish the connection for an already-registered state. */
  private async connect(state: MountedState): Promise<MountedState> {
    const config = state.config
    this.logs.append(config.id, 'info', `connecting to ${describeConfig(config)}`)
    try {
      const bridge = await this.loadBridge()
      const payload = this.bridgeConfig(config, config.serverName)
      const fiber = this.ctx.plugin(
        { name: bridge.name ?? 'mcp-client', inject: bridge.inject ?? [], apply: bridge.apply },
        payload,
      )
      state.fiber = fiber
      await withTimeout(fiber, this.mountTimeoutMs, `connection to ${config.title}`)
      if (this.disposed) {
        await fiber.dispose().catch(() => undefined)
        state.fiber = null
        return this.disabledState(config, 'plugin unloaded during connect')
      }
      state.status = 'connected'
      state.connectedAt = new Date().toISOString()
      state.lastError = undefined
      state.tools = this.toolsFor(config.serverName)
      this.logs.append(
        config.id,
        'info',
        `connected as mcp__${config.serverName}__* (${state.tools.length} tool(s))`,
      )
    } catch (error) {
      state.status = 'error'
      state.lastError = errorMessage(error)
      state.tools = []
      this.logs.append(config.id, 'error', `connection failed: ${state.lastError}`)
      if (state.fiber !== null) {
        await state.fiber.dispose().catch(() => undefined)
        state.fiber = null
      }
    }
    this.onChange(config.id)
    return state
  }

  private disabledState(config: ServerConfig, reason: string): MountedState {
    const state: MountedState = { config, fiber: null, status: 'disabled', tools: [] }
    this.states.set(config.id, state)
    this.logs.append(config.id, 'debug', `not connected: ${reason}`)
    this.onChange(config.id)
    return state
  }

  /** Dispose one live fiber without touching queued work. */
  private async unmountNow(id: string): Promise<void> {
    const state = this.states.get(id)
    if (state === undefined) return
    const fiber = state.fiber
    state.fiber = null
    if (fiber !== null) {
      try {
        await fiber.dispose()
        this.logs.append(id, 'info', 'disconnected')
      } catch (error) {
        this.logs.append(id, 'warn', `disposal reported: ${errorMessage(error)}`)
      }
    }
    this.states.delete(id)
    this.onChange(id)
  }

  /** Disconnect one server and forget its live state. */
  unmount(id: string): Promise<void> {
    return this.serialize(id, async () => {
      await this.unmountNow(id)
    })
  }

  /** Disconnect and reconnect one server, keeping its stored config. */
  restart(config: ServerConfig): Promise<MountedState> {
    return this.serialize(config.id, async () => {
      await this.unmountNow(config.id)
      const state: MountedState = {
        config,
        fiber: null,
        status: config.enabled ? 'connecting' : 'disabled',
        tools: [],
      }
      this.states.set(config.id, state)
      this.onChange(config.id)
      if (!config.enabled) return state
      return this.connect(state)
    })
  }

  /** Refresh the cached tool list of one already-connected server. */
  refreshTools(id: string): string[] {
    const state = this.states.get(id)
    if (state === undefined) return []
    state.tools = this.toolsFor(state.config.serverName)
    return state.tools
  }

  /**
   * Connect a throwaway instance to check a draft config, then dispose it.
   *
   * Runs the real bridge rather than a bespoke handshake, so "Test" reports what
   * an install would actually produce. The probe uses a random reserved
   * `serverName` so it can never collide with, or shadow, a live server.
   *
   * @param draft - a config assembled from the form, not yet persisted.
   * @param timeoutMs - overall budget for connect plus discovery.
   * @returns the tools discovered, or the failure message.
   */
  async probe(
    draft: ServerConfig,
    timeoutMs: number,
  ): Promise<{ ok: boolean; error?: string; tools: string[]; serverInfo?: { name: string; version: string } }> {
    const probeName = `probe-${Math.random().toString(36).slice(2, 10)}`
    const started = Date.now()
    const probe: ServerConfig = { ...draft, id: `probe:${probeName}`, serverName: probeName, enabled: true }
    let fiber: (Fiber & PromiseLike<Fiber>) | null = null
    try {
      const bridge = await this.loadBridge()
      const payload = this.bridgeConfig(probe, probeName)
      fiber = this.ctx.plugin(
        { name: bridge.name ?? 'mcp-client', inject: bridge.inject ?? [], apply: bridge.apply },
        payload,
      )
      await withTimeout(fiber, timeoutMs, `probe of ${draft.title}`)
      const tools = this.toolsFor(probeName)
      return { ok: true, tools }
    } catch (error) {
      return { ok: false, error: errorMessage(error), tools: [] }
    } finally {
      if (fiber !== null) await fiber.dispose().catch(() => undefined)
      void started
    }
  }

  /** Dispose every live server and refuse further mounts. */
  async dispose(): Promise<void> {
    this.disposed = true
    const ids = [...this.states.keys()]
    await Promise.all(ids.map((id) => this.serialize(id, () => this.unmountNow(id))))
  }
}

/** One-line description of where a config connects, for logs. */
export function describeConfig(config: ServerConfig): string {
  if (config.transport === 'stdio') {
    return [config.command, ...config.args].join(' ')
  }
  return config.url
}
