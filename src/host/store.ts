/**
 * Atomic JSON persistence for the installed-server list.
 *
 * One file holds every {@link ServerConfig}. Writes go through a temp file in
 * the same directory followed by a rename, so a crash can never leave a
 * half-written `servers.json` behind. Reads validate every entry; a file that
 * does not parse or does not validate is moved aside rather than deleted, and
 * `init()` reports that as a warning instead of taking the plugin down.
 *
 * @module @mfallah/dsh-mcp-studio/host/store
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import {
  SERVER_NAME_RE,
  STORE_FORMAT_VERSION,
  type ServerConfig,
} from '../shared/contract.js'

/** File name inside the store directory. */
export const SERVERS_FILE = 'servers.json'

/** On-disk shape of `servers.json`. */
export interface ServersFile {
  version: number
  servers: ServerConfig[]
}

/** Result of {@link ServerStore.init} / {@link SecretStore.init}. */
export interface StoreInit {
  /** Non-fatal problems: a quarantined file, an ignored bad entry, ... */
  warnings: string[]
}

export type StoreErrorCode =
  | 'corrupt'
  | 'version'
  | 'invalid'
  | 'duplicate-id'
  | 'duplicate-server-name'
  | 'not-found'

/** Every failure from this module is one of these, with a stable `code`. */
export class StoreError extends Error {
  readonly code: StoreErrorCode
  /** Quarantine path when a corrupt file was moved aside. */
  readonly quarantinePath?: string
  readonly path?: string

  constructor(
    code: StoreErrorCode,
    message: string,
    options: { path?: string; quarantinePath?: string; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'StoreError'
    this.code = code
    this.path = options.path
    this.quarantinePath = options.quarantinePath
  }
}

/**
 * Default store directory: `$DSH_HOME/mcp-studio`, where `DSH_HOME` defaults
 * to `~/.dsh`. The service resolves the directory from plugin config and
 * passes it in; this helper exists for that default only.
 */
export function defaultStoreDir(
  env: NodeJS.ProcessEnv = process.env,
  homeDirectory: string = '',
): string {
  const home = env.DSH_HOME?.trim()
  const base = home && home.length > 0 ? home : homeDirectory
  return join(base, 'mcp-studio')
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(at: string, detail: string): never {
  throw new StoreError('invalid', `${at}: ${detail}`)
}

function requiredString(value: unknown, at: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(at, 'expected a non-empty string')
  }
  return value
}

function optionalString(value: unknown, at: string): string | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') fail(at, 'expected a string')
  return value
}

function requiredBoolean(value: unknown, at: string): boolean {
  if (typeof value !== 'boolean') fail(at, 'expected a boolean')
  return value
}

function stringArray(value: unknown, at: string): string[] {
  if (!Array.isArray(value)) fail(at, 'expected an array of strings')
  return value.map((entry, index) => {
    if (typeof entry !== 'string') fail(`${at}[${index}]`, 'expected a string')
    return entry
  })
}

function stringMap(value: unknown, at: string): Record<string, string> {
  if (value === undefined || value === null) return {}
  if (!isRecord(value)) fail(at, 'expected an object of string values')
  const out: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string') fail(`${at}.${key}`, 'expected a string')
    out[key] = entry
  }
  return out
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], at: string): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T
  }
  fail(at, `expected one of ${allowed.join(', ')}`)
}

function isoString(value: unknown, at: string): string {
  const text = requiredString(value, at)
  if (Number.isNaN(Date.parse(text))) fail(at, 'expected an ISO-8601 timestamp')
  return text
}

/**
 * Validate one persisted server config and rebuild it with exactly the fields
 * the contract knows, so unknown keys never survive a round-trip.
 */
export function validateServerConfig(value: unknown, at = 'server'): ServerConfig {
  if (!isRecord(value)) fail(at, 'expected an object')

  const id = requiredString(value.id, `${at}.id`)
  if (!SERVER_NAME_RE.test(id)) {
    fail(`${at}.id`, 'must match [A-Za-z0-9_-]{1,32}')
  }
  const serverName = requiredString(value.serverName, `${at}.serverName`)
  if (!SERVER_NAME_RE.test(serverName)) {
    fail(`${at}.serverName`, 'must match [A-Za-z0-9_-]{1,32}')
  }

  const transport = oneOf(value.transport, ['stdio', 'streamable-http'] as const, `${at}.transport`)

  const source = oneOf(value.source, ['curated', 'registry', 'custom'] as const, `${at}.source`)

  const timeout = value.toolCallTimeoutMs
  if (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout < 1) {
    fail(`${at}.toolCallTimeoutMs`, 'expected a positive number of milliseconds')
  }

  const description = optionalString(value.description, `${at}.description`)
  const catalogId = optionalString(value.catalogId, `${at}.catalogId`)
  const homepage = optionalString(value.homepage, `${at}.homepage`)

  const base = {
    id,
    serverName,
    title: requiredString(value.title, `${at}.title`),
    transport,
    enabled: requiredBoolean(value.enabled, `${at}.enabled`),
    source,
    failOnStartupError: requiredBoolean(value.failOnStartupError, `${at}.failOnStartupError`),
    toolCallTimeoutMs: timeout,
    createdAt: isoString(value.createdAt, `${at}.createdAt`),
    updatedAt: isoString(value.updatedAt, `${at}.updatedAt`),
    ...(description !== undefined ? { description } : {}),
    ...(catalogId !== undefined ? { catalogId } : {}),
    ...(homepage !== undefined ? { homepage } : {}),
  }

  if (transport === 'stdio') {
    const command = requiredString(value.command, `${at}.command`)
    const cwd = optionalString(value.cwd, `${at}.cwd`)
    return {
      ...base,
      transport: 'stdio' as const,
      command,
      args: stringArray(value.args ?? [], `${at}.args`),
      env: stringMap(value.env, `${at}.env`),
      ...(cwd !== undefined ? { cwd } : {}),
    }
  }

  const url = requiredString(value.url, `${at}.url`)
  if (!/^https?:\/\//i.test(url)) {
    fail(`${at}.url`, 'expected an http(s) URL')
  }
  return {
    ...base,
    transport: 'streamable-http' as const,
    url,
    headers: stringMap(value.headers, `${at}.headers`),
  }
}

/** Validate a whole list, rejecting duplicate ids and server names. */
export function validateServerConfigs(value: unknown, at = 'servers'): ServerConfig[] {
  if (!Array.isArray(value)) fail(at, 'expected an array')
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  const out: ServerConfig[] = []
  value.forEach((entry, index) => {
    const config = validateServerConfig(entry, `${at}[${index}]`)
    if (seenIds.has(config.id)) {
      throw new StoreError('duplicate-id', `${at}[${index}]: duplicate id '${config.id}'`)
    }
    if (seenNames.has(config.serverName)) {
      throw new StoreError(
        'duplicate-server-name',
        `${at}[${index}]: duplicate serverName '${config.serverName}'`,
      )
    }
    seenIds.add(config.id)
    seenNames.add(config.serverName)
    out.push(config)
  })
  return out
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

/**
 * Parse the contents of `servers.json`. Accepts the current `{version,
 * servers}` envelope and a bare array (the shape written before the envelope
 * existed).
 */
export function parseServersFile(raw: string): ServerConfig[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new StoreError('corrupt', 'servers.json is not valid JSON', { cause: error })
  }

  if (Array.isArray(parsed)) {
    return validateServerConfigs(parsed)
  }
  if (!isRecord(parsed)) {
    throw new StoreError('corrupt', 'servers.json must contain an object or an array')
  }
  const version = parsed.version
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    throw new StoreError('corrupt', 'servers.json has no numeric version')
  }
  if (version !== STORE_FORMAT_VERSION) {
    throw new StoreError(
      'version',
      `servers.json uses format version ${version}; this plugin writes version ${STORE_FORMAT_VERSION}`,
    )
  }
  try {
    return validateServerConfigs(parsed.servers ?? [])
  } catch (error) {
    if (error instanceof StoreError) {
      throw new StoreError('corrupt', `servers.json is invalid: ${error.message}`, { cause: error })
    }
    throw error
  }
}

/** Serialize a server list into the current envelope. */
export function serializeServersFile(servers: readonly ServerConfig[]): string {
  const file: ServersFile = { version: STORE_FORMAT_VERSION, servers: [...servers] }
  return `${JSON.stringify(file, null, 2)}\n`
}

/**
 * Write `contents` to `file` atomically: write a sibling temp file, then
 * rename over the destination.
 */
export function writeFileAtomic(file: string, contents: string): void {
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2, 10)}.tmp`
  try {
    writeFileSync(tmp, contents, { encoding: 'utf8', mode: 0o600 })
    renameSync(tmp, file)
  } catch (error) {
    try {
      rmSync(tmp, { force: true })
    } catch {
      // Best effort: the temp file is already unusable.
    }
    throw error
  }
}

/**
 * Move a corrupt file aside so the store can start empty without destroying
 * the evidence. Returns the path it was moved to.
 */
export function quarantineFile(
  file: string,
  now: Date = new Date(),
  label = 'servers',
): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  const base = join(dirname(file), `${label}.corrupt-${stamp}.json`)
  let target = base
  let counter = 1
  while (existsSync(target)) {
    target = base.replace(/\.json$/, `-${counter}.json`)
    counter += 1
  }
  renameSync(file, target)
  return target
}

// ---------------------------------------------------------------------------
// ServerStore
// ---------------------------------------------------------------------------

export interface ServerStoreOptions {
  /** Store directory, resolved by the service from plugin config. */
  dir: string
  /** Process environment, kept for future path expansion. */
  env?: NodeJS.ProcessEnv
  /** Clock used for quarantine file names. Tests inject this. */
  now?: () => Date
  /**
   * Move a corrupt file aside instead of leaving it in place. Defaults to
   * true; `init()` surfaces the move as a warning.
   */
  quarantineOnCorrupt?: boolean
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

/**
 * The `servers.json` store: in-memory CRUD with an atomic write after every
 * mutation. `init()` must run before first use.
 */
export class ServerStore {
  readonly dir: string
  readonly env: NodeJS.ProcessEnv
  readonly file: string
  private readonly now: () => Date
  private readonly quarantineOnCorrupt: boolean
  private cache: ServerConfig[] | null = null
  private warnings: string[] = []

  constructor(options: ServerStoreOptions) {
    this.dir = options.dir
    this.env = options.env ?? process.env
    this.file = join(this.dir, SERVERS_FILE)
    this.now = options.now ?? (() => new Date())
    this.quarantineOnCorrupt = options.quarantineOnCorrupt !== false
  }

  /**
   * Create the store directory if missing and load `servers.json`. A corrupt
   * or unreadable file is moved aside and reported in `warnings`; `init()`
   * itself does not throw for that.
   */
  async init(): Promise<StoreInit> {
    this.warnings = []
    try {
      mkdirSync(this.dir, { recursive: true })
    } catch (error) {
      throw new StoreError('corrupt', `could not create store directory ${this.dir}`, {
        path: this.dir,
        cause: error,
      })
    }
    this.cache = this.readFromDisk()
    return { warnings: [...this.warnings] }
  }

  private readFromDisk(): ServerConfig[] {
    if (!existsSync(this.file)) return []
    let raw: string
    try {
      raw = readFileSync(this.file, 'utf8')
    } catch (error) {
      throw new StoreError('corrupt', `could not read ${this.file}`, {
        path: this.file,
        cause: error,
      })
    }
    try {
      return parseServersFile(raw)
    } catch (error) {
      const storeError =
        error instanceof StoreError
          ? error
          : new StoreError('corrupt', `${this.file} is unreadable`, { cause: error })
      if ((storeError.code === 'corrupt' || storeError.code === 'version') && this.quarantineOnCorrupt) {
        const quarantinePath = quarantineFile(this.file, this.now())
        this.warnings.push(
          `${storeError.message} — moved aside to ${quarantinePath}`,
        )
        return []
      }
      throw storeError
    }
  }

  /** Lazily load when a read happens before `init()`. */
  private loaded(): ServerConfig[] {
    if (!this.cache) {
      mkdirSync(this.dir, { recursive: true })
      this.cache = this.readFromDisk()
    }
    return this.cache
  }

  private persist(): void {
    writeFileAtomic(this.file, serializeServersFile(this.cache ?? []))
  }

  /** Drop the in-memory cache; the next read hits the disk again. */
  reload(): void {
    this.cache = null
  }

  list(): ServerConfig[] {
    return clone(this.loaded())
  }

  get(id: string): ServerConfig | undefined {
    const found = this.loaded().find((entry) => entry.id === id)
    return found ? clone(found) : undefined
  }

  findByName(serverName: string): ServerConfig | undefined {
    const found = this.loaded().find((entry) => entry.serverName === serverName)
    return found ? clone(found) : undefined
  }

  /**
   * Insert or replace by `id`. Throws when another entry already uses the
   * incoming `serverName`.
   */
  async upsert(config: ServerConfig): Promise<void> {
    const valid = validateServerConfig(config)
    const servers = this.loaded()
    const index = servers.findIndex((entry) => entry.id === valid.id)
    if (servers.some((entry, i) => i !== index && entry.serverName === valid.serverName)) {
      throw new StoreError(
        'duplicate-server-name',
        `a server with serverName '${valid.serverName}' already exists`,
      )
    }
    if (index >= 0) {
      servers[index] = valid
    } else {
      servers.push(valid)
    }
    this.persist()
  }

  /** Remove a server by id. Removing an unknown id is a no-op. */
  async remove(id: string): Promise<void> {
    const servers = this.loaded()
    const index = servers.findIndex((entry) => entry.id === id)
    if (index < 0) return
    servers.splice(index, 1)
    this.persist()
  }

  /** Replace the whole list, validating and persisting it. */
  async replaceAll(configs: readonly ServerConfig[]): Promise<void> {
    this.cache = validateServerConfigs([...configs])
    this.persist()
  }
}
