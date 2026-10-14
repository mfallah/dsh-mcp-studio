/**
 * A fake `McpStudioApi` for the client tests.
 *
 * Every method records its call, delegates to an optional per-test `hook`, and
 * otherwise behaves like a small in-memory host. That keeps the controller
 * tests honest about what the panel actually asks for.
 */
import type {
  CatalogEntry,
  CatalogPage,
  LogChunk,
  McpStudioApi,
  ProbeResult,
  RuntimeReport,
  ServerDetail,
  ServerDraft,
  ServerPatch,
  ServerView,
} from '../../src/shared/contract.js'

export interface Call {
  method: string
  args: unknown[]
}

export interface FakeState {
  servers: ServerView[]
  detail: Record<string, ServerDetail>
  catalog: CatalogPage
  categories: string[]
  runtimes: RuntimeReport
  secrets: string[]
  patch: string
  probe: ProbeResult
  logChunks: LogChunk[]
}

export interface FakeApi {
  api: McpStudioApi
  calls: Call[]
  state: FakeState
  hooks: Partial<Record<string, (...args: never[]) => unknown>>
  callsOf(method: string): Call[]
  lastCall(method: string): Call | undefined
  reset(): void
}

/** Build a `ServerView` with sensible defaults. */
export function makeServer(overrides: Partial<ServerView> = {}): ServerView {
  return {
    id: 'files',
    serverName: 'files',
    title: 'Filesystem',
    transport: 'stdio',
    enabled: true,
    source: 'custom',
    failOnStartupError: false,
    toolCallTimeoutMs: 60000,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'connected',
    tools: ['read_file', 'write_file'],
    toolCount: 2,
    target: 'npx -y @modelcontextprotocol/server-filesystem',
    secretKeys: [],
    usesSecrets: false,
    ...overrides,
  }
}

/** Build a `CatalogEntry` with sensible defaults. */
export function makeEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 'curated:filesystem',
    source: 'curated',
    slug: 'filesystem',
    title: 'Filesystem',
    description: 'Read and write files inside a directory.',
    publisher: 'modelcontextprotocol',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '{input:root}'],
    inputs: [
      { key: 'root', label: 'Root directory', required: true, secret: false, format: 'directory' },
    ],
    categories: ['files', 'core'],
    offline: true,
    ...overrides,
  }
}

/** Build a `ServerDetail` for `id` on top of `makeServer`. */
export function makeDetail(server: ServerView, config?: ServerDetail['config']): ServerDetail {
  return {
    ...server,
    config:
      config ??
      (server.transport === 'stdio'
        ? {
            ...server,
            transport: 'stdio',
            command: 'npx',
            args: ['-y', 'server'],
            env: {},
          }
        : { ...server, transport: 'streamable-http', url: 'https://example.com/mcp', headers: {} }),
    logs: [],
  }
}

const FALLBACK_RUNTIMES: RuntimeReport = {
  node: { available: true, path: 'C:/node/node.exe', version: 'v22.0.0' },
  npx: { available: true, version: '10.0.0' },
  docker: { available: false },
}

/** Create the fake host plus its call log. */
export function createFakeApi(overrides: Partial<FakeState> = {}): FakeApi {
  const state: FakeState = {
    servers: [],
    detail: {},
    catalog: { entries: [], total: 0, registryOnline: true },
    categories: [],
    runtimes: FALLBACK_RUNTIMES,
    secrets: [],
    patch: '# nothing yet\n',
    probe: { ok: true, durationMs: 12, tools: ['ping'] },
    logChunks: [],
    ...overrides,
  }
  const calls: Call[] = []
  const hooks: FakeApi['hooks'] = {}

  const invoke = <T>(method: string, args: unknown[], fallback: () => T | Promise<T>): Promise<T> => {
    calls.push({ method, args })
    const hook = hooks[method]
    if (hook) return Promise.resolve(hook(...(args as never[])) as T)
    return Promise.resolve(fallback())
  }

  const api: McpStudioApi = {
    listServers: () => invoke('listServers', [], () => [...state.servers]),

    getServer: (id) =>
      invoke('getServer', [id], () => state.detail[id] ?? null),

    addServer: (draft: ServerDraft) =>
      invoke('addServer', [draft], () => {
        const server = makeServer({
          id: draft.serverName ?? 'manual',
          serverName: draft.serverName ?? 'manual',
          title: draft.title,
          transport: draft.transport,
          source: 'custom',
          status: 'connecting',
          toolCount: 0,
          tools: [],
          target: draft.transport === 'stdio' ? `${draft.command ?? ''}`.trim() : draft.url ?? '',
        })
        state.servers = [server, ...state.servers]
        return server
      }),

    updateServer: (id, patch: ServerPatch) =>
      invoke('updateServer', [id, patch], () => {
        const current = state.servers.find((server) => server.id === id) ?? makeServer({ id })
        const next = { ...current, ...patch, updatedAt: '2026-01-02T00:00:00.000Z' } as ServerView
        state.servers = state.servers.map((server) => (server.id === id ? next : server))
        return next
      }),

    removeServer: (id) =>
      invoke('removeServer', [id], () => {
        state.servers = state.servers.filter((server) => server.id !== id)
        return undefined
      }),

    setEnabled: (id, enabled) =>
      invoke('setEnabled', [id, enabled], () => {
        const next = makeServer({ id, enabled, status: enabled ? 'connecting' : 'disabled' })
        state.servers = state.servers.map((server) => (server.id === id ? next : server))
        return next
      }),

    restartServer: (id) =>
      invoke('restartServer', [id], () => makeServer({ id, status: 'connected' })),

    testConnection: (draft) => invoke('testConnection', [draft], () => state.probe),

    getLogs: (id, sinceSeq) =>
      invoke('getLogs', [id, sinceSeq], (): LogChunk => {
        const entries = state.logChunks
          .flatMap((chunk) => chunk.entries)
          .filter((entry) => entry.seq > sinceSeq)
          .sort((left, right) => left.seq - right.seq)
        const last = entries[entries.length - 1]
        return { serverId: id, entries, nextSeq: last ? last.seq : sinceSeq }
      }),

    catalog: (query) =>
      invoke('catalog', [query], (): CatalogPage => {
        const text = (query.text ?? '').toLowerCase()
        const entries = state.catalog.entries.filter((entry) => {
          if (query.category && !entry.categories.includes(query.category)) return false
          if (query.source && entry.source !== query.source) return false
          if (text === '') return true
          return `${entry.title} ${entry.publisher} ${entry.description}`.toLowerCase().includes(text)
        })
        return { ...state.catalog, entries, total: entries.length }
      }),

    catalogCategories: () => invoke('catalogCategories', [], () => [...state.categories]),

    installFromCatalog: (catalogId, values) =>
      invoke('installFromCatalog', [catalogId, values], (): ServerDraft => {
        // Faithful to the host: validate required inputs, substitute
        // `{input:key}` in the template, and turn secret inputs into
        // `${secret:<key>}` references instead of literals.
        const entry = state.catalog.entries.find((candidate) => candidate.id === catalogId)
        if (!entry) throw new Error(`unknown catalog id: ${catalogId}`)
        const resolved: Record<string, string> = {}
        for (const input of entry.inputs) {
          const typed = values[input.key]
          const value = typed !== undefined && typed.trim() !== '' ? typed.trim() : input.defaultValue
          if (value === undefined || value.trim() === '') {
            if (input.required) throw new Error(`missing required input(s): ${input.key}`)
            continue
          }
          resolved[input.key] = value
        }
        const substitute = (text: string) =>
          text.replace(/\{input:([^}]+)\}/g, (_match, key: string) => {
            const input = entry.inputs.find((candidate) => candidate.key === key)
            if (!input) throw new Error(`unknown input '${key}'`)
            if (input.secret) return `\${secret:${input.key}}`
            return resolved[key] ?? ''
          })
        const draft: ServerDraft = {
          transport: entry.transport,
          title: entry.title,
          serverName: entry.slug,
          failOnStartupError: false,
        }
        if (entry.transport === 'stdio') {
          draft.command = substitute(entry.command ?? '')
          draft.args = (entry.args ?? []).map(substitute)
        } else {
          draft.url = substitute(entry.url ?? '')
        }
        return draft
      }),

    detectRuntimes: () => invoke('detectRuntimes', [], () => state.runtimes),

    listSecretNames: () => invoke('listSecretNames', [], () => [...state.secrets]),

    setSecret: (name, value) =>
      invoke('setSecret', [name, value], () => {
        if (!state.secrets.includes(name)) state.secrets = [...state.secrets, name]
        return undefined
      }),

    deleteSecret: (name) =>
      invoke('deleteSecret', [name], () => {
        state.secrets = state.secrets.filter((secret) => secret !== name)
        return undefined
      }),

    resolveConfig: () =>
      invoke('resolveConfig', [], () => ({ ok: true, missingEnv: [], missingSecrets: [] })),

    exportPatch: () => invoke('exportPatch', [], () => state.patch),
  }

  return {
    api,
    calls,
    state,
    hooks,
    callsOf: (method) => calls.filter((call) => call.method === method),
    lastCall: (method) => calls.filter((call) => call.method === method).pop(),
    reset: () => {
      calls.length = 0
    },
  }
}

/** A deterministic clock that fires due intervals only when the test advances it. */
export function createTestClock() {
  let now = 0
  let seq = 0
  const timers = new Map<number, { fn: () => void; ms: number; next: number }>()
  const clock = {
    now: () => now,
    setInterval: (fn: () => void, ms: number) => {
      seq += 1
      timers.set(seq, { fn, ms, next: now + ms })
      return seq
    },
    clearInterval: (handle: number) => {
      timers.delete(handle)
    },
  }
  return {
    clock,
    /** Advance time and fire every interval that is now due. */
    async advance(ms: number) {
      now += ms
      for (const [handle, timer] of [...timers]) {
        if (timer.next > now) continue
        timer.next = now + timer.ms
        timer.fn()
        await flush()
        if (!timers.has(handle)) continue
      }
    },
    active: () => timers.size,
  }
}

/** Let queued promise callbacks run. */
export function flush(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

/** An English translator over a small dictionary, for component tests. */
export function makeT(dict: Record<string, string>) {
  return (key: string, params?: Record<string, unknown>) => {
    const template = dict[key] ?? key
    if (!params) return template
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    )
  }
}
