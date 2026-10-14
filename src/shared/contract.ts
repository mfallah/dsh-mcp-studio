/**
 * Frozen contract between the MCP Studio host half and client half.
 *
 * This module is the single source of truth for the shape of persisted data,
 * the remote API surface, and the event names. Host code and client code both
 * import from here; neither side may invent a field the other does not know.
 *
 * Rules:
 * - All values crossing the RPC boundary are plain JSON (no Date, no Map,
 *   no functions, no class instances).
 * - Every method returns a value or throws; nothing returns `undefined` for a
 *   "missing" case except where the type explicitly says `| null`.
 * - Secret VALUES never cross the boundary. Only secret NAMES do.
 *
 * @module @mfallah/dsh-mcp-studio/contract
 */

/** Version of the persisted store format. Bump only with a migration. */
export const STORE_FORMAT_VERSION = 1

/** Host Cordis service key and Typert wire namespace. */
export const SERVICE_KEY = 'mcpStudio'

/** Client sidebar / main-panel id. Also the panel route key. */
export const PANEL_ID = 'mcp-studio'

/** Locale namespace registered by the client half. */
export const LOCALE_NS = 'mcp-studio'

/** Event namespace prefix emitted by the host half. */
export const EVENT_CHANGED = 'mcp-studio/changed'
/** Per-server log chunk event: payload is {@link LogChunk}. */
export const EVENT_LOG = 'mcp-studio/log'

/** Whole-value placeholder: the entire string is one `${env:NAME}` reference. */
export const ENV_PLACEHOLDER = /^\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}$/
/** Whole-value placeholder: the entire string is one `${secret:NAME}` reference. */
export const SECRET_PLACEHOLDER = /^\$\{secret:([A-Za-z0-9._-]{1,64})\}$/
/**
 * Scan form: every `${env:NAME}` / `${secret:NAME}` occurrence ANYWHERE in a
 * value, including embedded ones such as `Authorization: Bearer ${secret:TOKEN}`.
 *
 * Use this to discover references and the two anchored patterns above only to
 * ask "is this whole value a single reference?". The scan form is a global
 * regex, so reset `lastIndex` (or use `String.prototype.matchAll`) between uses.
 */
export const PLACEHOLDER_PATTERN = /\$\{(env|secret):([A-Za-z0-9._-]{1,64})\}/g
/** Detect any placeholder, for redaction in the UI. */
export const ANY_PLACEHOLDER = /\$\{(?:env|secret):[^}]+\}/

// ---------------------------------------------------------------------------
// Server configuration
// ---------------------------------------------------------------------------

export type McpTransport = 'stdio' | 'streamable-http'

/** Where a server entry came from; drives catalog affordances in the UI. */
export type ServerSource = 'curated' | 'registry' | 'custom'

/** Keys of the inputs a catalog entry asks the user to fill in. */
export interface CatalogInput {
  key: string
  label: string
  description?: string
  /** Required inputs block installation until they are filled. */
  required: boolean
  /** Secret inputs are routed to the secret store, never to servers.json. */
  secret: boolean
  /** Pre-fills the form; may itself contain a `${env:...}` placeholder. */
  defaultValue?: string
  placeholder?: string
  /** Narrow rendering hint for the form. */
  format: 'string' | 'number' | 'boolean' | 'file' | 'directory' | 'password'
}

/** Transport-independent part of one installed server. */
export interface ServerBase {
  /** Stable, user-invisible key. Must satisfy `[A-Za-z0-9_-]{1,32}`. */
  id: string
  /** Namespace the server's tools appear under: `mcp__<id>__<tool>`. */
  serverName: string
  /** Human title shown in the list. */
  title: string
  description?: string
  transport: McpTransport
  /** Disabled servers stay configured but are not mounted. */
  enabled: boolean
  source: ServerSource
  /** Catalog identifier this entry was installed from, when applicable. */
  catalogId?: string
  /** Homepage or repository URL, when known. */
  homepage?: string
  /** Reject plugin activation when the initial connection fails. */
  failOnStartupError: boolean
  /** Per-call timeout forwarded to the MCP client plugin. */
  toolCallTimeoutMs: number
  /** ISO-8601 timestamps. */
  createdAt: string
  updatedAt: string
}

/** A server launched as a local child process. */
export interface StdioServer extends ServerBase {
  transport: 'stdio'
  /** Executable resolved through PATH, e.g. `npx`, `uvx`, `docker`. */
  command: string
  args: string[]
  /**
   * Extra environment merged over the harness's scrubbed ambient environment.
   * Values may be literals, `${env:NAME}` or `${secret:NAME}` placeholders.
   */
  env: Record<string, string>
  cwd?: string
}

/** A server reached over Streamable HTTP. */
export interface HttpServer extends ServerBase {
  transport: 'streamable-http'
  url: string
  /** Extra request headers. Same placeholder rules as stdio `env`. */
  headers: Record<string, string>
}

export type ServerConfig = StdioServer | HttpServer

/** Live lifecycle state owned by the host connection supervisor. */
export type ServerStatus =
  | 'connected'
  | 'connecting'
  | 'error'
  | 'disabled'
  | 'stopped'

/** A config row plus its live state, as sent to the client. */
export interface ServerView extends ServerBase {
  status: ServerStatus
  /** Tool raw names reported by the server, sorted. Empty while disconnected. */
  tools: string[]
  toolCount: number
  /** Last connection error message, cleared on a successful connect. */
  lastError?: string
  /** ISO-8601 of the last successful connect. */
  connectedAt?: string
  /** Non-secret transport summary for the list row, e.g. `npx -y pkg`. */
  target: string
  /** Env/header KEY names only; values are always redacted out. */
  secretKeys: string[]
  /** Whether at least one env/header value is a `${secret:...}` placeholder. */
  usesSecrets: boolean
}

/** Full detail for the drawer: config with placeholder values preserved. */
export interface ServerDetail extends ServerView {
  /** The persisted config, secret placeholders intact, literal values shown. */
  config: ServerConfig
  /** Rolling log tail, oldest first. */
  logs: LogEntry[]
}

/** A draft the UI sends before a server exists. */
export interface ServerDraft {
  transport: McpTransport
  title: string
  description?: string
  serverName?: string
  /**
   * Provenance. `installFromCatalog` fills these in so an entry installed from
   * the catalog keeps its origin in the panel instead of looking hand-made.
   */
  source?: ServerSource
  catalogId?: string
  homepage?: string
  /** stdio */
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  /** streamable-http */
  url?: string
  headers?: Record<string, string>
  failOnStartupError?: boolean
  toolCallTimeoutMs?: number
}

/**
 * Update payload: every field optional; omitted fields keep their value.
 * Provenance is excluded — a caller must not be able to relabel a server.
 */
export type ServerPatch = Partial<Omit<ServerDraft, 'transport' | 'source' | 'catalogId' | 'homepage'>> & {
  enabled?: boolean
}

// ---------------------------------------------------------------------------
// Connections, probes, logs
// ---------------------------------------------------------------------------

/** One line of the per-server log ring buffer. */
export interface LogEntry {
  seq: number
  at: string
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
}

/** A batch of log lines, for incremental tailing by `sinceSeq`. */
export interface LogChunk {
  serverId: string
  entries: LogEntry[]
  /** Seq to pass next time; equal to the last entry's seq, or unchanged. */
  nextSeq: number
}

/** Result of a pre-save connection probe. */
export interface ProbeResult {
  ok: boolean
  /** Human-readable failure reason when `ok` is false. */
  error?: string
  /** Machine-readable failure class for UI copy. */
  code?:
    | 'spawn-failed'
    | 'command-missing'
    | 'http-error'
    | 'handshake-failed'
    | 'timeout'
    | 'invalid-config'
    | 'namespace-in-use'
  /** Server self-reported name and version on success. */
  serverInfo?: { name: string; version: string }
  /** Discovered tool raw names on success. */
  tools?: string[]
  /** Wall-clock duration of the probe. */
  durationMs: number
  /** Protocol revision negotiated, when the SDK reports one. */
  protocolVersion?: string
}

/** Which local executables an MCP server could use, probed once per session. */
export interface RuntimeReport {
  node?: RuntimeInfo
  npx?: RuntimeInfo
  npm?: RuntimeInfo
  pnpm?: RuntimeInfo
  bunx?: RuntimeInfo
  uvx?: RuntimeInfo
  python?: RuntimeInfo
  docker?: RuntimeInfo
}

export interface RuntimeInfo {
  available: boolean
  /** Resolved absolute path when found. */
  path?: string
  /** `--version` output, trimmed to one line. */
  version?: string
}

/**
 * Result of resolving every placeholder in a config against the current
 * environment and secret store.
 */
export interface ResolutionReport {
  ok: boolean
  /** Placeholder names that could not be resolved. */
  missingEnv: string[]
  missingSecrets: string[]
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export type CatalogSource = 'curated' | 'registry'

/** One installable server offered by the catalog. */
export interface CatalogEntry {
  /** `<source>:<slug>`; stable, used as `catalogId`. */
  id: string
  source: CatalogSource
  /** Stable slug within the source. */
  slug: string
  title: string
  description: string
  publisher: string
  version?: string
  transport: McpTransport
  /** stdio template; `args` may contain `{input:key}` placeholders. */
  command?: string
  args?: string[]
  /** streamable-http template. */
  url?: string
  /** Inputs the user must supply before the entry becomes installable. */
  inputs: CatalogInput[]
  /**
   * How inputs reach the server.
   *
   * An argv placeholder `{input:key}` inside `args` (or `{input:key}` inside
   * `url`) is substituted in place. Any input whose key is NOT referenced that
   * way is routed to the transport's environment: stdio `env` or http
   * `headers`, keyed by `input.key`. A `secret: true` input becomes the literal
   * `${secret:<key>}` reference; any other becomes the user's value.
   */
  // (documentation field — no runtime value; see install-template.ts)
  /** Free-form tags used for filtering, lowercase. */
  categories: string[]
  homepage?: string
  license?: string
  /** Small inline emoji or single-character glyph for the row. */
  glyph?: string
  /** True when the entry is bundled with the plugin and works offline. */
  offline: boolean
}

export interface CatalogQuery {
  /** Free-text query; empty means "everything". */
  text?: string
  category?: string
  source?: CatalogSource
  limit?: number
}

export interface CatalogPage {
  entries: CatalogEntry[]
  /** Total before `limit` was applied. */
  total: number
  /** True when the official registry answered; false means curated-only. */
  registryOnline: boolean
  /** Non-fatal reason the registry was skipped. */
  registryError?: string
}

// ---------------------------------------------------------------------------
// Remote API (the frozen surface)
// ---------------------------------------------------------------------------

/**
 * The host service surface. Implemented by `McpStudioService`; the client half
 * consumes it through `ctx.remote.mcpStudio`. Method names are the wire names.
 */
export interface McpStudioApi {
  /** Every configured server with its live status, newest first. */
  listServers(): Promise<ServerView[]>
  /** One server with config and log tail, or null when the id is unknown. */
  getServer(id: string): Promise<ServerDetail | null>
  /** Persist a new server and mount it when enabled. */
  addServer(draft: ServerDraft): Promise<ServerView>
  /** Change an existing server; remounts in place. */
  updateServer(id: string, patch: ServerPatch): Promise<ServerView>
  /** Unmount and delete a server and its secrets. */
  removeServer(id: string): Promise<void>
  /** Enable or disable without deleting. */
  setEnabled(id: string, enabled: boolean): Promise<ServerView>
  /** Tear down and re-establish the connection. */
  restartServer(id: string): Promise<ServerView>
  /** Connect a draft without persisting it. */
  testConnection(draft: ServerDraft): Promise<ProbeResult>
  /** Incremental log tail. */
  getLogs(id: string, sinceSeq: number): Promise<LogChunk>

  /** Search the catalog; merges the curated offline set with the registry. */
  catalog(query: CatalogQuery): Promise<CatalogPage>
  /** Categories present in the current catalog, for the filter row. */
  catalogCategories(): Promise<string[]>
  /**
   * Turn a catalog entry plus the values the user filled in into a draft that
   * `testConnection` / `addServer` accept. Runs the `{input:key}` substitution
   * on the host so the templating rules live in one place.
   */
  installFromCatalog(catalogId: string, values: Record<string, string>): Promise<ServerDraft>

  /** Which local runtimes are available. Cached for the session. */
  detectRuntimes(): Promise<RuntimeReport>
  /** Secret names known to the store; never the values. */
  listSecretNames(): Promise<string[]>
  /** Store or replace one secret value. */
  setSecret(name: string, value: string): Promise<void>
  /** Delete one secret; fails when a server still references it. */
  deleteSecret(name: string): Promise<void>
  /** Verify a config's placeholders resolve before connecting it. */
  resolveConfig(draft: ServerDraft): Promise<ResolutionReport>

  /** Render this plugin's state as a `cordis.patch.yml` insert list. */
  exportPatch(): Promise<string>
}

/** Event payload for {@link EVENT_CHANGED}. */
export interface ChangedEvent {
  /** Server ids whose state moved; empty means "reload everything". */
  ids: string[]
  /** What moved, so the client can avoid a full refetch when it can. */
  reason: 'added' | 'updated' | 'removed' | 'status' | 'catalog'
}

// ---------------------------------------------------------------------------
// Helpers shared by both halves
// ---------------------------------------------------------------------------

/** Matches the `serverName` grammar accepted by the MCP client plugin. */
export const SERVER_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/

/** Turn a title into a legal `serverName`, deterministically. */
export function slugifyServerName(title: string, fallback = 'server'): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
  return slug.length > 0 ? slug : fallback
}

/** True when a value is a `${secret:...}` placeholder. */
export function isSecretRef(value: string): boolean {
  return SECRET_PLACEHOLDER.test(value)
}

/** True when a value is a `${env:...}` placeholder. */
export function isEnvRef(value: string): boolean {
  return ENV_PLACEHOLDER.test(value)
}

/** Strip secrets and env refs out of a value for display. */
export function redactValue(key: string, value: string): string {
  if (isSecretRef(value)) return value
  if (ANY_PLACEHOLDER.test(value)) return value
  if (/key|token|secret|password|auth/i.test(key)) return '••••••••'
  return value
}

/** One-line description of where a server connects, for list rows. */
export function describeTarget(config: ServerConfig): string {
  if (config.transport === 'stdio') {
    return [config.command, ...config.args].join(' ').trim()
  }
  return config.url
}
