/**
 * Secret value store.
 *
 * Values live in `<storeDir>/secrets.json` beside the server list, never in
 * `servers.json` and never in an event or a log line. The only API that can
 * return a value is {@link SecretStore.get}; everything else exposes names.
 * On Windows the file's ACL is tightened to the current user best-effort after
 * every write, because the default inheritance on a profile directory usually
 * grants more than the file needs.
 *
 * @module @mfallah/dsh-mcp-studio/host/secrets
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  SECRET_PLACEHOLDER,
  STORE_FORMAT_VERSION,
  type ServerConfig,
} from '../shared/contract.js'
import {
  StoreError,
  quarantineFile,
  writeFileAtomic,
  type StoreInit,
} from './store.js'

/** File name inside the store directory. */
export const SECRETS_FILE = 'secrets.json'

/** Names accepted by {@link SecretStore.set}, matching the placeholder grammar. */
export const SECRET_NAME_RE = /^[A-Za-z0-9._-]{1,64}$/

/** On-disk shape of `secrets.json`. */
export interface SecretsFile {
  version: number
  secrets: Record<string, string>
}

export interface SecretStoreOptions {
  /** Store directory, resolved by the service from plugin config. */
  dir: string
  /**
   * Tighten the file ACL to the current user on Windows. Defaults to true;
   * tests turn it off. Ignored on other platforms.
   */
  tightenAcl?: boolean
  /** Clock used for quarantine file names. Tests inject this. */
  now?: () => Date
}

/**
 * `icacls` arguments that strip inheritance and grant only `user` access.
 * Pure, so the command shape is testable without touching a file.
 */
export function icaclsArgs(file: string, user: string): string[] {
  return [file, '/inheritance:r', '/grant:r', `${user}:F`]
}

/**
 * Best-effort ACL tightening. Every failure is swallowed: a lock-down that
 * does not work must not stop the plugin from storing a secret.
 */
export function tightenFileAcl(
  file: string,
  options: { platform?: NodeJS.Platform; user?: string; quiet?: boolean } = {},
): boolean {
  const platform = options.platform ?? process.platform
  if (platform !== 'win32') return false
  const user = options.user ?? process.env.USERNAME ?? process.env.USER
  if (!user) return false
  try {
    execFileSync('icacls', icaclsArgs(file, user), {
      stdio: 'ignore',
      windowsHide: true,
      timeout: 5_000,
    })
    return true
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Validate a secret name against the placeholder grammar. */
export function assertSecretName(name: string): string {
  if (typeof name !== 'string' || !SECRET_NAME_RE.test(name)) {
    throw new StoreError('invalid', `invalid secret name '${String(name)}'`)
  }
  return name
}

/** Parse `secrets.json`; throws a `corrupt` {@link StoreError} on bad input. */
export function parseSecretsFile(raw: string): Record<string, string> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new StoreError('corrupt', 'secrets.json is not valid JSON', { cause: error })
  }
  const envelope = isRecord(parsed) && !Array.isArray(parsed) ? parsed : null
  if (!envelope) {
    throw new StoreError('corrupt', 'secrets.json must contain an object')
  }
  if (typeof envelope.version !== 'number') {
    throw new StoreError('corrupt', 'secrets.json has no numeric version')
  }
  if (envelope.version !== STORE_FORMAT_VERSION) {
    throw new StoreError(
      'version',
      `secrets.json uses format version ${envelope.version}; this plugin writes version ${STORE_FORMAT_VERSION}`,
    )
  }
  if (!isRecord(envelope.secrets)) {
    throw new StoreError('corrupt', 'secrets.json has no secrets object')
  }
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(envelope.secrets)) {
    if (typeof value !== 'string') {
      throw new StoreError('corrupt', `secrets.json entry '${key}' is not a string`)
    }
    if (!SECRET_NAME_RE.test(key)) {
      throw new StoreError('corrupt', `secrets.json entry '${key}' has an invalid name`)
    }
    out[key] = value
  }
  return out
}

/** Serialize a secret record into the current envelope. */
export function serializeSecretsFile(secrets: Readonly<Record<string, string>>): string {
  const file: SecretsFile = { version: STORE_FORMAT_VERSION, secrets: { ...secrets } }
  return `${JSON.stringify(file, null, 2)}\n`
}

/** Names of every secret referenced by a server config's env/headers. */
export function secretRefsIn(config: ServerConfig): string[] {
  const values =
    config.transport === 'stdio' ? Object.values(config.env) : Object.values(config.headers)
  const names: string[] = []
  for (const value of values) {
    const match = SECRET_PLACEHOLDER.exec(value)
    if (match?.[1] && !names.includes(match[1])) names.push(match[1])
  }
  return names
}

/**
 * The secret value store. Values never leave through anything but `get()`.
 */
export class SecretStore {
  readonly dir: string
  readonly file: string
  private readonly tightenAcl: boolean
  private readonly now: () => Date
  private cache: Record<string, string> | null = null
  private warnings: string[] = []

  constructor(options: SecretStoreOptions) {
    this.dir = options.dir
    this.file = join(this.dir, SECRETS_FILE)
    this.tightenAcl = options.tightenAcl !== false
    this.now = options.now ?? (() => new Date())
  }

  /** Create the store directory, load the file, quarantine a corrupt one. */
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
    if (existsSync(this.file)) this.applyAcl()
    return { warnings: [...this.warnings] }
  }

  private readFromDisk(): Record<string, string> {
    if (!existsSync(this.file)) return {}
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
      return parseSecretsFile(raw)
    } catch (error) {
      const storeError =
        error instanceof StoreError
          ? error
          : new StoreError('corrupt', `${this.file} is unreadable`, { cause: error })
      if (storeError.code === 'corrupt' || storeError.code === 'version') {
        const quarantinePath = quarantineFile(this.file, this.now(), 'secrets')
        this.warnings.push(`${storeError.message} — moved aside to ${quarantinePath}`)
        return {}
      }
      throw storeError
    }
  }

  private loaded(): Record<string, string> {
    if (!this.cache) {
      mkdirSync(this.dir, { recursive: true })
      this.cache = this.readFromDisk()
    }
    return this.cache
  }

  private applyAcl(): void {
    if (this.tightenAcl) tightenFileAcl(this.file)
  }

  private persist(): void {
    writeFileAtomic(this.file, serializeSecretsFile(this.cache ?? {}))
    this.applyAcl()
  }

  /** Secret names, sorted. Values are never included. */
  names(): string[] {
    return Object.keys(this.loaded()).sort()
  }

  /** The value of one secret, or undefined when it is not stored. */
  get(name: string): string | undefined {
    if (!SECRET_NAME_RE.test(name)) return undefined
    return this.loaded()[name]
  }

  has(name: string): boolean {
    return SECRET_NAME_RE.test(name) && Object.hasOwn(this.loaded(), name)
  }

  /** Store or replace one secret value. */
  async set(name: string, value: string): Promise<void> {
    assertSecretName(name)
    if (typeof value !== 'string') {
      throw new StoreError('invalid', `secret '${name}' must be a string`)
    }
    const secrets = this.loaded()
    secrets[name] = value
    this.persist()
  }

  /** Delete one secret. Deleting an unknown name is a no-op. */
  async delete(name: string): Promise<void> {
    assertSecretName(name)
    const secrets = this.loaded()
    if (!Object.hasOwn(secrets, name)) return
    delete secrets[name]
    this.persist()
  }

  /**
   * Resolve a `${secret:NAME}` placeholder, or a bare name, to its value.
   * Returns undefined when the name is unknown.
   */
  resolve(ref: string): string | undefined {
    const match = SECRET_PLACEHOLDER.exec(ref)
    return this.get(match?.[1] ?? ref)
  }
}
