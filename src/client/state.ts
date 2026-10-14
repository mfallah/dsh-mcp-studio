/**
 * The single state owner behind the MCP Studio panel.
 *
 * Framework-free on purpose: the controller talks only to a `McpStudioApi`
 * facade (see `rpc.ts`) and a pluggable clock, so the whole behaviour — catalog
 * search, install, probe, log tailing, polling, optimistic-but-honest actions —
 * is testable in plain vitest with a fake host.
 *
 * There are no host events over this transport. Freshness comes from three
 * sources, all owned here:
 *   1. an immediate refetch after every mutation,
 *   2. a cheap `listServers()` poll while the panel is visible,
 *   3. a refetch when the panel becomes visible again.
 * The log tailer polls `getLogs(id, sinceSeq)` while the Logs tab is open.
 *
 * @module @mfallah/dsh-mcp-studio/client/state
 */
import type {
  CatalogEntry,
  CatalogQuery,
  LogEntry,
  McpStudioApi,
  ProbeResult,
  RuntimeReport,
  ServerDetail,
  ServerDraft,
  ServerPatch,
  ServerView,
} from '../shared/contract.js'
import { errorMessage } from './rpc.js'
import { secretInputWrites, type SecretWrite } from './secrets.js'

/** Tab selected in the page header. */
export type StudioTab = 'catalog' | 'installed'
/** Tab selected inside the server drawer. */
export type DrawerTab = 'tools' | 'logs' | 'settings'
/** Lifecycle of one async view. */
export type LoadPhase = 'idle' | 'loading' | 'ready' | 'error'

/** One async read: its phase, last good value, and failure detail. */
export interface AsyncView<T> {
  phase: LoadPhase
  value: T
  /** Human-readable failure from the last attempt, cleared on success. */
  error?: string
  /** True when the last attempt failed but a previous value is still shown. */
  stale?: boolean
}

/** Catalog plus the registry-side metadata the page explains in copy. */
export interface CatalogView extends AsyncView<CatalogEntry[]> {
  total: number
  registryOnline: boolean
  registryError?: string
}

/** What the overlay currently shows, if anything. */
export type StudioSelection =
  | { kind: 'catalog'; id: string }
  | { kind: 'server'; id: string }
  | { kind: 'manual' }
  | null

/**
 * Every mutable field the controller owns. Views never see this type; they
 * subscribe to {@link StudioSnapshot}, whose collection members are read-only.
 */
export interface StudioState {
  /** Whether the panel is the active main panel (drives polling). */
  visible: boolean
  tab: StudioTab
  servers: AsyncView<ServerView[]>
  catalog: CatalogView
  catalogQuery: CatalogQuery
  categories: string[]
  runtimes: AsyncView<RuntimeReport | null>
  secrets: AsyncView<string[]>
  selection: StudioSelection
  drawerTab: DrawerTab
  detail: AsyncView<ServerDetail | null>
  logs: LogEntry[]
  logsPhase: LoadPhase
  logsError?: string
  probe: AsyncView<ProbeResult | null>
  patch: AsyncView<string | null>
  /** Keys with an in-flight action, so rows can disable exactly themselves. */
  busy: Set<string>
  /** Per-action failure text, rendered inline next to the action. */
  actionErrors: Record<string, string | undefined>
  /** Monotonic stamp of the last successful server read. */
  serversReadAt?: number
}

/**
 * The read-only view a component renders from. Collections are exposed as
 * `Readonly*` so no view can mutate controller state by accident.
 */
export type StudioSnapshot = Readonly<Omit<StudioState, 'busy' | 'actionErrors'>> & {
  readonly busy: ReadonlySet<string>
  readonly actionErrors: Readonly<Record<string, string | undefined>>
}

/** Busy/error key builders; views and controller share these strings. */
export const busyKey = {
  catalog: 'catalog',
  servers: 'servers',
  runtimes: 'runtimes',
  secrets: 'secrets',
  patch: 'patch',
  probe: 'probe',
  install: 'install',
  detail: 'detail',
  server: (id: string, action: string) => `server:${id}:${action}`,
  secret: (name: string) => `secret:${name}`,
} as const

/** Action error keys that are not derived from an id. */
export const errorKey = {
  install: 'install',
  manual: 'manual',
  patch: 'patch',
  probe: 'probe',
  catalog: 'catalog',
  servers: 'servers',
  secrets: 'secrets',
  runtimes: 'runtimes',
} as const

/** Timer surface, injectable so tests can drive polling deterministically. */
export interface StudioClock {
  now(): number
  setInterval(handler: () => void, ms: number): number
  clearInterval(handle: number): void
}

const defaultClock: StudioClock = {
  now: () => Date.now(),
  setInterval: (handler, ms) => globalThis.setInterval(handler, ms) as unknown as number,
  clearInterval: (handle) => {
    globalThis.clearInterval(handle as unknown as ReturnType<typeof globalThis.setInterval>)
  },
}

/** Options accepted by {@link McpStudioController}. */
export interface StudioControllerOptions {
  api: McpStudioApi
  clock?: StudioClock
  /** Server poll while visible; defaults to 5s. */
  pollMs?: number
  /** Log poll while the Logs tab is open; defaults to 2s. */
  logPollMs?: number
  /** Rolling log cap; defaults to 400 lines. */
  maxLogLines?: number
}

/** Result of an action the views render inline. */
export interface ActionResult {
  ok: boolean
  error?: string
}

/**
 * Result of a catalog install or test.
 *
 * `secretsStored` tells the sheet that the raw secret answers have left the
 * browser for good, so it can replace them in its own state with their
 * `${secret:...}` references.
 */
export interface CatalogOutcome extends ActionResult {
  /** True once every raw secret input was written to the secret store. */
  secretsStored: boolean
  /** The probe result on the Test path; null when nothing was probed. */
  result: ProbeResult | null
}

function view<T>(value: T): AsyncView<T> {
  return { phase: 'idle', value }
}

/** Build the pristine state (exported for tests and the page's initial render). */
export function createInitialSnapshot(): StudioState {
  return {
    visible: false,
    tab: 'catalog',
    servers: view<ServerView[]>([]),
    catalog: { ...view<CatalogEntry[]>([]), total: 0, registryOnline: true },
    catalogQuery: {},
    categories: [],
    runtimes: view<RuntimeReport | null>(null),
    secrets: view<string[]>([]),
    selection: null,
    drawerTab: 'tools',
    detail: view<ServerDetail | null>(null),
    logs: [],
    logsPhase: 'idle',
    probe: view<ProbeResult | null>(null),
    patch: view<string | null>(null),
    busy: new Set<string>(),
    actionErrors: {},
  }
}

/**
 * Owns every read and write the panel performs.
 *
 * Views subscribe through {@link subscribe}/{@link getSnapshot}; nothing else
 * holds state. Every mutation re-reads truth from the host on completion, even
 * when it failed, so the UI never drifts from the store.
 */
export class McpStudioController {
  private readonly api: McpStudioApi
  private readonly clock: StudioClock
  private readonly pollMs: number
  private readonly logPollMs: number
  private readonly maxLogLines: number

  private readonly listeners = new Set<() => void>()
  private state: StudioState = createInitialSnapshot()
  private snapshot: StudioSnapshot = this.state

  private pollHandle: number | null = null
  private logHandle: number | null = null
  private logsSeq = 0
  private disposed = false

  constructor(options: StudioControllerOptions) {
    this.api = options.api
    this.clock = options.clock ?? defaultClock
    this.pollMs = options.pollMs ?? 5000
    this.logPollMs = options.logPollMs ?? 2000
    this.maxLogLines = options.maxLogLines ?? 400
  }

  // -- subscription ---------------------------------------------------------

  /** Stable getSnapshot for `useSyncExternalStore`. */
  readonly getSnapshot = (): StudioSnapshot => this.snapshot

  /** Stable subscribe for `useSyncExternalStore`. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private publish(): void {
    this.snapshot = { ...this.state }
    for (const listener of [...this.listeners]) {
      try {
        listener()
      } catch (error) {
        console.error('mcp-studio: subscriber crashed', error)
      }
    }
  }

  private setBusy(key: string, busy: boolean): void {
    if (busy) this.state.busy.add(key)
    else this.state.busy.delete(key)
  }

  private setError(key: string, error: unknown | undefined): void {
    if (error === undefined) {
      delete this.state.actionErrors[key]
    } else {
      this.state.actionErrors[key] = errorMessage(error)
    }
  }

  /** Whether an action key has an in-flight call. */
  isBusy(key: string): boolean {
    return this.state.busy.has(key)
  }

  /** Inline failure text for an action key, if the last attempt failed. */
  errorOf(key: string): string | undefined {
    return this.state.actionErrors[key]
  }

  // -- lifecycle ------------------------------------------------------------

  /**
   * Toggle the panel's visibility. Becoming visible triggers a refetch of
   * everything that is stale and starts the cheap server poll; becoming hidden
   * stops every timer.
   * @param visible - whether the panel is the active main panel.
   */
  setVisible(visible: boolean): void {
    if (this.disposed || visible === this.state.visible) return
    this.state.visible = visible
    if (visible) {
      this.startPolling()
      void this.loadAll()
    } else {
      this.stopPolling()
      this.stopLogPolling()
    }
    this.publish()
  }

  /** Manual refresh: reload whichever views the active tab shows. */
  async refresh(): Promise<void> {
    await this.loadAll()
  }

  /** Stop every timer and drop subscribers. Idempotent. */
  dispose(): void {
    this.disposed = true
    this.stopPolling()
    this.stopLogPolling()
    this.listeners.clear()
  }

  private startPolling(): void {
    if (this.pollHandle !== null) return
    this.pollHandle = this.clock.setInterval(() => {
      void this.loadServers(true)
      if (this.state.selection?.kind === 'server') void this.loadDetail(this.state.selection.id, true)
    }, this.pollMs)
  }

  private stopPolling(): void {
    if (this.pollHandle === null) return
    this.clock.clearInterval(this.pollHandle)
    this.pollHandle = null
  }

  private startLogPolling(): void {
    if (this.logHandle !== null) return
    this.logHandle = this.clock.setInterval(() => {
      const selection = this.state.selection
      if (selection?.kind !== 'server') {
        this.stopLogPolling()
        return
      }
      void this.loadLogs(selection.id)
    }, this.logPollMs)
  }

  private stopLogPolling(): void {
    if (this.logHandle === null) return
    this.clock.clearInterval(this.logHandle)
    this.logHandle = null
  }

  /** Load everything the panel can show; failures land per view, never thrown. */
  async loadAll(): Promise<void> {
    await Promise.all([this.loadServers(), this.loadCatalog(), this.loadRuntimes(), this.loadSecrets()])
  }

  // -- servers --------------------------------------------------------------

  /**
   * Read every configured server and its live status.
   * @param quiet - true for a poll tick: keep the current list on screen while
   *   re-reading, and mark it stale instead of replacing it with an error.
   */
  async loadServers(quiet = false): Promise<void> {
    const previous = this.state.servers
    if (!quiet) this.state.servers = { ...previous, phase: previous.value.length > 0 ? 'ready' : 'loading' }
    else this.setBusy(busyKey.servers, true)
    this.publish()
    try {
      const servers = await this.api.listServers()
      this.state.servers = { phase: 'ready', value: servers }
      this.state.serversReadAt = this.clock.now()
    } catch (error) {
      const message = errorMessage(error)
      if (quiet && previous.value.length > 0) {
        this.state.servers = { ...previous, stale: true, error: message }
      } else {
        this.state.servers = { phase: 'error', value: previous.value, error: message, stale: previous.value.length > 0 }
      }
    } finally {
      if (quiet) this.setBusy(busyKey.servers, false)
      this.publish()
    }
  }

  /**
   * Persist a new server from a draft the caller already resolved.
   *
   * @param draft - the server draft.
   * @param secrets - `{name, value}` pairs to store before the server is added.
   * @returns the outcome; the panel renders `error` inline when `ok` is false.
   */
  async install(draft: ServerDraft, secrets: SecretWrite[] = []): Promise<ActionResult> {
    return this.runInstall(async () => {
      const stored = await this.persistSecrets(secrets)
      if (!stored.ok) throw new Error(stored.error ?? 'mcp-studio: the secret could not be stored')
      return this.api.addServer(draft)
    })
  }

  /**
   * Install one catalog entry.
   *
   * Order matters and is the whole point of this method: the raw secret answers
   * are written to the secret store first, then the host turns the entry into a
   * draft (a pure transformation that replaces secret inputs with
   * `${secret:<key>}`), then the draft is added. If storing a secret fails, no
   * draft is built and nothing is added.
   *
   * @param entry - the catalog entry being installed.
   * @param values - the input values the user filled in.
   */
  async installCatalogEntry(entry: CatalogEntry, values: Record<string, string>): Promise<CatalogOutcome> {
    let secretsStored = false
    const result = await this.runInstall(async () => {
      const stored = await this.persistSecrets(secretInputWrites(entry, values))
      if (!stored.ok) throw new Error(stored.error ?? 'mcp-studio: the secret could not be stored')
      secretsStored = true
      return this.api.addServer(await this.api.installFromCatalog(entry.id, values))
    })
    return { ...result, secretsStored, result: null }
  }

  /**
   * Store secret values one by one, stopping at the first rejection.
   *
   * Public because the manual-add form persists its env/header secrets through
   * this same guarded path before it submits the draft.
   *
   * @param writes - the values to store, in order.
   * @returns `ok: true` once every value is stored (and the name list re-read).
   */
  async persistSecrets(writes: SecretWrite[]): Promise<ActionResult> {
    if (writes.length === 0) return { ok: true }
    this.setBusy(busyKey.secrets, true)
    this.setError(errorKey.secrets, undefined)
    this.publish()
    try {
      for (const write of writes) {
        try {
          await this.api.setSecret(write.name, write.value)
        } catch (error) {
          const message = errorMessage(error)
          this.setError(errorKey.secrets, error)
          return { ok: false, error: message }
        }
      }
      await this.loadSecrets()
      return { ok: true }
    } finally {
      this.setBusy(busyKey.secrets, false)
      this.publish()
    }
  }

  private async runInstall(perform: () => Promise<ServerView>): Promise<ActionResult> {
    if (this.isBusy(busyKey.install)) return { ok: false, error: 'mcp-studio: an install is already running' }
    this.setBusy(busyKey.install, true)
    this.setError(errorKey.install, undefined)
    this.publish()
    try {
      const created = await perform()
      await Promise.all([this.loadServers(), this.loadSecrets()])
      this.state.tab = 'installed'
      this.state.selection = { kind: 'server', id: created.id }
      this.state.drawerTab = 'tools'
      this.logsSeq = 0
      this.state.logs = []
      this.state.logsPhase = 'idle'
      await this.loadDetail(created.id)
      this.startLogPolling()
      return { ok: true }
    } catch (error) {
      const message = errorMessage(error)
      this.setError(errorKey.install, error)
      // Re-read truth even on failure: a partial write must be visible.
      await this.loadServers(true)
      return { ok: false, error: message }
    } finally {
      this.setBusy(busyKey.install, false)
      this.publish()
    }
  }

  /**
   * Probe a draft without persisting it.
   * @param draft - the draft to connect.
   */
  async testDraft(draft: ServerDraft): Promise<ProbeResult | null> {
    return this.runProbe(() => this.api.testConnection(draft))
  }

  /**
   * Probe a catalog entry before installing it.
   *
   * Same order as installation: store the raw secret answers first, then let the
   * host build the draft, then connect. A failed secret write stops the flow and
   * is reported through the probe view.
   *
   * @param entry - the catalog entry being tested.
   * @param values - the input values the user filled in.
   */
  async testCatalogEntry(entry: CatalogEntry, values: Record<string, string>): Promise<CatalogOutcome> {
    this.setBusy(busyKey.probe, true)
    this.setError(errorKey.probe, undefined)
    this.state.probe = { phase: 'loading', value: this.state.probe.value }
    this.publish()
    try {
      const stored = await this.persistSecrets(secretInputWrites(entry, values))
      if (!stored.ok) {
        const error = stored.error ?? 'mcp-studio: the secret could not be stored'
        this.state.probe = { phase: 'error', value: null, error }
        return { ok: false, error, secretsStored: false, result: null }
      }
      const result = await this.api.testConnection(await this.api.installFromCatalog(entry.id, values))
      this.state.probe = { phase: 'ready', value: result }
      return { ok: true, secretsStored: true, result }
    } catch (error) {
      const message = errorMessage(error)
      this.state.probe = { phase: 'error', value: null, error: message }
      return { ok: false, error: message, secretsStored: false, result: null }
    } finally {
      this.setBusy(busyKey.probe, false)
      this.publish()
    }
  }

  private async runProbe(perform: () => Promise<ProbeResult>): Promise<ProbeResult | null> {
    this.setBusy(busyKey.probe, true)
    this.setError(errorKey.probe, undefined)
    this.state.probe = { phase: 'loading', value: this.state.probe.value }
    this.publish()
    try {
      const result = await perform()
      this.state.probe = { phase: 'ready', value: result }
      return result
    } catch (error) {
      this.state.probe = { phase: 'error', value: null, error: errorMessage(error) }
      return null
    } finally {
      this.setBusy(busyKey.probe, false)
      this.publish()
    }
  }

  /** Enable or disable one server, then re-read the list. */
  async toggleServer(id: string, enabled: boolean): Promise<ActionResult> {
    const key = busyKey.server(id, 'toggle')
    if (this.isBusy(key)) return { ok: false }
    this.setBusy(key, true)
    this.setError(key, undefined)
    this.publish()
    try {
      await this.api.setEnabled(id, enabled)
      await this.loadServers(true)
      return { ok: true }
    } catch (error) {
      this.setError(key, error)
      await this.loadServers(true)
      return { ok: false, error: errorMessage(error) }
    } finally {
      this.setBusy(key, false)
      this.publish()
    }
  }

  /** Tear down and re-establish one connection, then re-read the list. */
  async restartServer(id: string): Promise<ActionResult> {
    const key = busyKey.server(id, 'restart')
    if (this.isBusy(key)) return { ok: false }
    this.setBusy(key, true)
    this.setError(key, undefined)
    this.publish()
    try {
      await this.api.restartServer(id)
      await this.loadServers(true)
      await this.loadDetail(id, true)
      return { ok: true }
    } catch (error) {
      this.setError(key, error)
      await this.loadServers(true)
      return { ok: false, error: errorMessage(error) }
    } finally {
      this.setBusy(key, false)
      this.publish()
    }
  }

  /** Save an edit to one server, then re-read the list and detail. */
  async saveServer(id: string, patch: ServerPatch): Promise<ActionResult> {
    const key = busyKey.server(id, 'save')
    if (this.isBusy(key)) return { ok: false }
    this.setBusy(key, true)
    this.setError(key, undefined)
    this.publish()
    try {
      await this.api.updateServer(id, patch)
      await this.loadServers(true)
      await this.loadDetail(id, true)
      return { ok: true }
    } catch (error) {
      this.setError(key, error)
      await this.loadServers(true)
      return { ok: false, error: errorMessage(error) }
    } finally {
      this.setBusy(key, false)
      this.publish()
    }
  }

  /** Remove a server; closes the drawer when it was showing that server. */
  async removeServer(id: string): Promise<ActionResult> {
    const key = busyKey.server(id, 'remove')
    if (this.isBusy(key)) return { ok: false }
    this.setBusy(key, true)
    this.setError(key, undefined)
    this.publish()
    try {
      await this.api.removeServer(id)
      if (this.state.selection?.kind === 'server' && this.state.selection.id === id) this.closeSelection()
      await this.loadServers(true)
      return { ok: true }
    } catch (error) {
      this.setError(key, error)
      await this.loadServers(true)
      return { ok: false, error: errorMessage(error) }
    } finally {
      this.setBusy(key, false)
      this.publish()
    }
  }

  // -- detail, logs ---------------------------------------------------------

  /**
   * Read one server's config and log tail.
   * @param id - server id.
   * @param quiet - true for a poll tick: keep the drawer populated while re-reading.
   */
  async loadDetail(id: string, quiet = false): Promise<void> {
    if (!quiet) this.state.detail = { ...this.state.detail, phase: 'loading' }
    this.publish()
    try {
      const detail = await this.api.getServer(id)
      this.state.detail = { phase: 'ready', value: detail }
    } catch (error) {
      this.state.detail = { phase: 'error', value: this.state.detail.value, error: errorMessage(error), stale: true }
    } finally {
      this.publish()
    }
  }

  /** Incremental log tail for one server; appends, dedupes by seq, and caps. */
  async loadLogs(id: string): Promise<void> {
    if (this.state.logsPhase === 'idle') {
      this.state.logsPhase = 'loading'
      this.publish()
    }
    try {
      const chunk = await this.api.getLogs(id, this.logsSeq)
      this.logsSeq = Math.max(this.logsSeq, chunk.nextSeq)
      if (chunk.entries.length > 0) {
        const merged = [...this.state.logs]
        const seen = new Set(merged.map((entry) => entry.seq))
        for (const entry of chunk.entries) {
          if (seen.has(entry.seq)) continue
          seen.add(entry.seq)
          merged.push(entry)
        }
        merged.sort((left, right) => left.seq - right.seq)
        this.state.logs = merged.slice(-this.maxLogLines)
      }
      this.state.logsPhase = 'ready'
      delete this.state.logsError
    } catch (error) {
      this.state.logsError = errorMessage(error)
      if (this.state.logs.length === 0) this.state.logsPhase = 'error'
    } finally {
      this.publish()
    }
  }

  /** Drop the rendered log lines (the host ring buffer is untouched). */
  clearLogs(): void {
    this.logsSeq = 0
    this.state.logs = []
    this.state.logsPhase = 'idle'
    delete this.state.logsError
    this.publish()
  }

  // -- catalog --------------------------------------------------------------

  /**
   * Read the catalog for the current query.
   * @param quiet - keep the current entries on screen while re-reading.
   */
  async loadCatalog(quiet = false): Promise<void> {
    const previous = this.state.catalog
    if (!quiet) {
      this.state.catalog = { ...previous, phase: previous.value.length > 0 ? 'ready' : 'loading' }
      this.publish()
    }
    try {
      const page = await this.api.catalog(this.state.catalogQuery)
      this.state.catalog = {
        phase: 'ready',
        value: page.entries,
        total: page.total,
        registryOnline: page.registryOnline,
        ...(page.registryError === undefined ? {} : { registryError: page.registryError }),
      }
    } catch (error) {
      const message = errorMessage(error)
      this.state.catalog = {
        ...previous,
        phase: previous.value.length > 0 ? 'ready' : 'error',
        error: message,
        stale: previous.value.length > 0,
      }
    } finally {
      this.publish()
    }
    if (this.state.categories.length === 0) void this.loadCategories()
  }

  /** Read the category chips once the catalog is known. */
  async loadCategories(): Promise<void> {
    try {
      this.state.categories = await this.api.catalogCategories()
    } catch {
      // Categories are decoration: a failure must not blank the catalog.
      this.state.categories = []
    } finally {
      this.publish()
    }
  }

  /** Merge a catalog query and re-read. */
  setCatalogQuery(patch: CatalogQuery): void {
    this.state.catalogQuery = { ...this.state.catalogQuery, ...patch }
    this.publish()
    void this.loadCatalog()
  }

  // -- runtimes, secrets, patch --------------------------------------------

  /** Read which local executables are available. */
  async loadRuntimes(): Promise<void> {
    this.state.runtimes = { ...this.state.runtimes, phase: 'loading' }
    this.publish()
    try {
      this.state.runtimes = { phase: 'ready', value: await this.api.detectRuntimes() }
    } catch (error) {
      this.state.runtimes = { phase: 'error', value: this.state.runtimes.value, error: errorMessage(error) }
    } finally {
      this.publish()
    }
  }

  /** Read the stored secret names (never their values). */
  async loadSecrets(): Promise<void> {
    this.state.secrets = { ...this.state.secrets, phase: 'loading' }
    this.publish()
    try {
      this.state.secrets = { phase: 'ready', value: await this.api.listSecretNames() }
    } catch (error) {
      this.state.secrets = { phase: 'error', value: this.state.secrets.value, error: errorMessage(error) }
    } finally {
      this.publish()
    }
  }

  /** Store or replace one secret value. */
  async saveSecret(name: string, value: string): Promise<ActionResult> {
    const key = busyKey.secret(name)
    this.setBusy(key, true)
    this.setError(errorKey.secrets, undefined)
    this.publish()
    try {
      await this.api.setSecret(name, value)
      await this.loadSecrets()
      return { ok: true }
    } catch (error) {
      this.setError(errorKey.secrets, error)
      return { ok: false, error: errorMessage(error) }
    } finally {
      this.setBusy(key, false)
      this.publish()
    }
  }

  /** Delete one secret by name. */
  async removeSecret(name: string): Promise<ActionResult> {
    const key = busyKey.secret(name)
    this.setBusy(key, true)
    this.setError(errorKey.secrets, undefined)
    this.publish()
    try {
      await this.api.deleteSecret(name)
      await this.loadSecrets()
      return { ok: true }
    } catch (error) {
      this.setError(errorKey.secrets, error)
      return { ok: false, error: errorMessage(error) }
    } finally {
      this.setBusy(key, false)
      this.publish()
    }
  }

  /** Render the plugin state as a patch insert list. */
  async exportPatch(): Promise<ActionResult> {
    this.setBusy(busyKey.patch, true)
    this.setError(errorKey.patch, undefined)
    this.state.patch = { ...this.state.patch, phase: 'loading' }
    this.publish()
    try {
      const yaml = await this.api.exportPatch()
      this.state.patch = { phase: 'ready', value: yaml }
      return { ok: true }
    } catch (error) {
      this.state.patch = { phase: 'error', value: this.state.patch.value, error: errorMessage(error) }
      this.setError(errorKey.patch, error)
      return { ok: false, error: errorMessage(error) }
    } finally {
      this.setBusy(busyKey.patch, false)
      this.publish()
    }
  }

  // -- navigation -----------------------------------------------------------

  /** Switch the top-level tab, loading anything that tab needs. */
  setTab(tab: StudioTab): void {
    if (this.state.tab === tab) return
    this.state.tab = tab
    this.publish()
    if (tab === 'installed' && this.state.servers.phase === 'idle') void this.loadServers()
    if (tab === 'catalog' && this.state.catalog.phase === 'idle') void this.loadCatalog()
  }

  /** Open the install sheet for one catalog entry. */
  selectCatalogEntry(id: string | null): void {
    if (id === null) {
      this.closeSelection()
      return
    }
    this.state.selection = { kind: 'catalog', id }
    this.state.probe = view<ProbeResult | null>(null)
    this.setError(errorKey.install, undefined)
    this.publish()
  }

  /** Open the drawer for one installed server and start tailing its logs. */
  selectServer(id: string | null): void {
    if (id === null) {
      this.closeSelection()
      return
    }
    this.state.selection = { kind: 'server', id }
    this.state.drawerTab = 'tools'
    this.logsSeq = 0
    this.state.logs = []
    this.state.logsPhase = 'idle'
    this.publish()
    void this.loadDetail(id)
    void this.loadLogs(id)
    this.startLogPolling()
  }

  /** Open the manual-add form. */
  selectManual(): void {
    this.state.selection = { kind: 'manual' }
    this.setError(errorKey.manual, undefined)
    this.publish()
  }

  /** Close whatever overlay is open and stop log tailing. */
  closeSelection(): void {
    this.state.selection = null
    this.stopLogPolling()
    this.publish()
  }

  /** Switch the drawer tab; starts or stops the log tailer accordingly. */
  setDrawerTab(tab: DrawerTab): void {
    if (this.state.drawerTab === tab) return
    this.state.drawerTab = tab
    this.publish()
    const selection = this.state.selection
    if (tab === 'logs' && selection?.kind === 'server') {
      void this.loadLogs(selection.id)
      this.startLogPolling()
    } else {
      this.stopLogPolling()
    }
  }

  /** The server currently shown in the drawer, when there is one. */
  selectedServer(): ServerView | undefined {
    const selection = this.state.selection
    if (selection?.kind !== 'server') return undefined
    return this.state.servers.value.find((server) => server.id === selection.id)
  }

  /** The catalog entry currently shown in the install sheet, when there is one. */
  selectedCatalogEntry(): CatalogEntry | undefined {
    const selection = this.state.selection
    if (selection?.kind !== 'catalog') return undefined
    return this.state.catalog.value.find((entry) => entry.id === selection.id)
  }

  /** Run a quiet re-read of every view the visible tab depends on. */
  async reloadVisible(): Promise<void> {
    if (this.state.tab === 'installed') await this.loadServers(true)
    else await this.loadCatalog(true)
  }
}
