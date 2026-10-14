/**
 * The catalog: the curated offline set merged with the official MCP registry.
 *
 * The registry is strictly an enhancement. Any failure — network, timeout,
 * non-2xx, malformed body, an entry shape we do not understand — degrades to
 * curated-only results and reports the reason in
 * {@link CatalogPage.registryError}. Nothing here throws because the registry
 * is down or because it changed shape.
 *
 * The endpoint is the frozen preview line `GET <base>/v0.1/servers`; reads need
 * no authentication and paginate with the registry's own `cursor`/`limit`
 * parameters.
 *
 * @module @mfallah/dsh-mcp-studio/host/catalog
 */

import {
  type CatalogEntry,
  type CatalogInput,
  type CatalogPage,
  type CatalogQuery,
} from '../shared/contract.js'
import { CURATED_CATALOG } from './catalog-data.js'

/** Registry path appended to the configured base URL. */
export const REGISTRY_PATH = '/v0.1/servers'

/** Registry page size requested per call. */
export const DEFAULT_PAGE_LIMIT = 50

/** Registry pages fetched per search, at most. */
export const DEFAULT_MAX_PAGES = 2

/** Cache lifetime for one registry response. */
export const DEFAULT_CACHE_TTL_MS = 5 * 60_000

/** Overall budget for one registry search, including every page. */
export const DEFAULT_TIMEOUT_MS = 6_000

export interface CatalogOptions {
  /** Base URL of the registry, e.g. `https://registry.modelcontextprotocol.io`. */
  registryUrl: string
  /** When false the catalog is curated-only and no request is made. */
  enabled: boolean
  /** Injected for tests. Defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch
  /** Registry response cache lifetime. Defaults to {@link DEFAULT_CACHE_TTL_MS}. */
  cacheTtlMs?: number
  /** Overall registry budget. Defaults to {@link DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number
  /** Curated entries, injected for tests. Defaults to the shipped set. */
  curated?: readonly CatalogEntry[]
  /** Page size per registry call. Defaults to {@link DEFAULT_PAGE_LIMIT}. */
  pageLimit?: number
  /** Page cap per search. Defaults to {@link DEFAULT_MAX_PAGES}. */
  maxPages?: number
  /** Clock, injected for tests. */
  now?: () => number
}

// ---------------------------------------------------------------------------
// Registry wire types (v0.1 preview)
// ---------------------------------------------------------------------------

/**
 * One entry of `server.packages[].environmentVariables[]` or
 * `server.packages[].arguments[]`. Both carry the same descriptive fields;
 * arguments additionally become `{input:key}` placeholders in the argv.
 */
export interface RawRegistryVariable {
  name?: string
  description?: string
  isRequired?: boolean
  isSecret?: boolean
  format?: string
  choices?: string[]
  default?: unknown
  placeholder?: string
  /** Literal argv token for a fixed (unnamed) argument. */
  value?: string
  type?: string
}

export type RawEnvVar = RawRegistryVariable
export type RawArgument = RawRegistryVariable

export interface RawRegistryPackage {
  registryType?: string
  identifier?: string
  version?: string
  runtimeHint?: string
  transport?: { type?: string }
  environmentVariables?: RawRegistryVariable[]
  arguments?: RawRegistryVariable[]
}

export interface RawRegistryRemote {
  /** The spec spells this `transportType`; older payloads used `type`. */
  transportType?: string
  type?: string
  url?: string
}

export interface RawRegistryServer {
  name?: string
  title?: string
  description?: string
  version?: string
  websiteUrl?: string
  repository?: { url?: string; source?: string }
  icons?: { src?: string; mimeType?: string }[]
  packages?: RawRegistryPackage[]
  remotes?: RawRegistryRemote[]
}

export interface RawRegistryWrapper {
  server?: RawRegistryServer
  _meta?: Record<string, unknown>
}

export interface RawRegistryPage {
  servers?: (RawRegistryServer | RawRegistryWrapper)[]
  metadata?: { nextCursor?: string | null; count?: number }
}

// ---------------------------------------------------------------------------
// URL building
// ---------------------------------------------------------------------------

/** Build the registry search URL for one page. */
export function buildRegistryUrl(
  registryUrl: string,
  options: { search?: string; limit?: number; cursor?: string } = {},
): string {
  const base = registryUrl.replace(/\/+$/, '')
  const params = new URLSearchParams()
  const search = options.search?.trim()
  if (search) params.set('search', search)
  if (typeof options.limit === 'number' && options.limit > 0) {
    params.set('limit', String(Math.floor(options.limit)))
  }
  if (options.cursor) params.set('cursor', options.cursor)
  const query = params.toString()
  return `${base}${REGISTRY_PATH}${query ? `?${query}` : ''}`
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Take the server object out of a v0.1 wrapper, or return it unchanged. */
export function unwrapRegistryServer(entry: RawRegistryServer | RawRegistryWrapper): {
  server: RawRegistryServer
  meta: Record<string, unknown>
} {
  const candidate = entry as RawRegistryWrapper
  if (isRecord(candidate.server)) {
    return {
      server: candidate.server,
      meta: isRecord(candidate._meta) ? candidate._meta : {},
    }
  }
  return { server: entry as RawRegistryServer, meta: {} }
}

/** `io.github.owner/repo` → `owner`-ish publisher label. */
export function publisherFrom(raw: RawRegistryServer): string {
  const identifier = raw.packages?.find((entry) => entry.identifier)?.identifier ?? ''
  if (identifier.startsWith('@')) {
    const scope = identifier.slice(1).split('/')[0]
    if (scope) return scope
  }
  const name = raw.name ?? ''
  const match = /^[a-z0-9.-]+\.([a-z0-9-]+)\//i.exec(name)
  if (match?.[1]) return match[1]
  return 'MCP Registry'
}

/** Prettify the last path segment of a reverse-DNS registry name. */
export function titleFromName(name: string): string {
  const segment = name.split('/').pop() ?? name
  return segment
    .split(/[-_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Stable slug for a registry name: `io.github.owner/repo` →
 * `io-github-owner-repo`. Unlike the server-name slug it keeps up to 64
 * characters, so two servers in one namespace do not collapse together.
 */
export function slugifyRegistryName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

function formatFrom(raw: RawRegistryVariable): CatalogInput['format'] {
  if (raw.isSecret) return 'password'
  if (raw.format === 'filepath') return 'file'
  if (raw.format === 'directory') return 'directory'
  if (raw.format === 'number') return 'number'
  if (raw.format === 'boolean') return 'boolean'
  return 'string'
}

/**
 * Map one registry variable/argument into a {@link CatalogInput}.
 * `choices` has no contract field, so it is folded into the description.
 * Returns null when the entry has no usable name.
 */
export function inputFromVariable(raw: RawRegistryVariable): CatalogInput | null {
  const key = typeof raw.name === 'string' ? raw.name.trim() : ''
  if (!key) return null
  const choices = Array.isArray(raw.choices)
    ? raw.choices.filter((choice): choice is string => typeof choice === 'string')
    : []
  const description = [
    typeof raw.description === 'string' ? raw.description.trim() : '',
    choices.length > 0 ? `One of: ${choices.join(', ')}.` : '',
  ]
    .filter((part) => part.length > 0)
    .join(' ')
  const defaultValue =
    raw.default === undefined || raw.default === null
      ? undefined
      : typeof raw.default === 'string'
        ? raw.default
        : JSON.stringify(raw.default)
  return {
    key,
    label: key,
    required: raw.isRequired === true,
    secret: raw.isSecret === true,
    format: formatFrom(raw),
    ...(description.length > 0 ? { description } : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(typeof raw.placeholder === 'string' && raw.placeholder.length > 0
      ? { placeholder: raw.placeholder }
      : {}),
  }
}

/**
 * One package → `{ command, args }` plus the inputs its arguments describe.
 * Returns null for a registry type we cannot launch today.
 */
export function launchFromPackage(
  pkg: RawRegistryPackage,
): { command: string; args: string[]; inputs: CatalogInput[] } | null {
  const identifier = pkg.identifier?.trim()
  if (!identifier) return null
  const hinted = pkg.runtimeHint?.trim().toLowerCase()
  const registryType = pkg.registryType?.trim().toLowerCase()

  let command: string
  let args: string[]
  if (hinted === 'npx' || hinted === 'npm' || registryType === 'npm') {
    command = 'npx'
    args = ['-y', pkg.version ? `${identifier}@${pkg.version}` : identifier]
  } else if (hinted === 'uvx' || hinted === 'uv' || registryType === 'pypi') {
    command = 'uvx'
    args = [identifier]
  } else if (hinted === 'docker' || registryType === 'oci') {
    command = 'docker'
    args = ['run', '-i', '--rm', identifier]
  } else {
    return null
  }

  const inputs: CatalogInput[] = []
  const seen = new Set<string>()
  for (const raw of pkg.arguments ?? []) {
    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    if (!name) {
      if (typeof raw.value === 'string' && raw.value.length > 0) args.push(raw.value)
      continue
    }
    const input = inputFromVariable(raw)
    if (input && !seen.has(input.key)) {
      seen.add(input.key)
      inputs.push(input)
    }
    args.push(`{input:${name}}`)
  }
  return { command, args, inputs }
}

/**
 * Normalize one v0.1 registry entry into a {@link CatalogEntry}.
 * Returns null when the entry has neither a launchable package nor a
 * Streamable HTTP remote, or when its shape is not understood.
 */
export function normalizeRegistryServer(
  entry: RawRegistryServer | RawRegistryWrapper,
): CatalogEntry | null {
  try {
    const { server } = unwrapRegistryServer(entry)
    const name = server.name?.trim()
    if (!name) return null
    const slug = slugifyRegistryName(name)
    if (!slug) return null

    const packages = Array.isArray(server.packages) ? server.packages : []
    const remotes = Array.isArray(server.remotes) ? server.remotes : []
    const remote = remotes.find(
      (candidate) =>
        (candidate?.transportType ?? candidate?.type) === 'streamable-http' &&
        typeof candidate.url === 'string' &&
        candidate.url.length > 0,
    )

    const inputs: CatalogInput[] = []
    const seenInputs = new Set<string>()
    for (const pkg of packages) {
      for (const variable of pkg.environmentVariables ?? []) {
        const input = inputFromVariable(variable)
        if (!input || seenInputs.has(input.key)) continue
        seenInputs.add(input.key)
        inputs.push(input)
      }
    }

    const websiteUrl =
      typeof server.websiteUrl === 'string' && server.websiteUrl.length > 0
        ? server.websiteUrl
        : server.repository?.url

    const base = {
      id: `registry:${slug}`,
      source: 'registry' as const,
      slug,
      title: server.title?.trim() || titleFromName(name),
      description: server.description?.trim() || '',
      publisher: publisherFrom(server),
      inputs,
      categories: ['registry'],
      offline: false,
      ...(server.version ? { version: server.version } : {}),
      ...(websiteUrl ? { homepage: websiteUrl } : {}),
      glyph: '📦',
    }

    if (remote?.url) {
      return {
        ...base,
        transport: 'streamable-http',
        url: remote.url,
        categories: [...base.categories, 'remote'],
      }
    }

    for (const pkg of packages) {
      const launch = launchFromPackage(pkg)
      if (!launch) continue
      for (const input of launch.inputs) {
        if (seenInputs.has(input.key)) continue
        seenInputs.add(input.key)
        inputs.push(input)
      }
      return {
        ...base,
        transport: 'stdio',
        command: launch.command,
        args: launch.args,
        categories: [...base.categories, launch.command === 'docker' ? 'container' : 'stdio'],
      }
    }
    return null
  } catch {
    // The API is pre-GA: an unknown shape must never break a search.
    return null
  }
}

/**
 * Normalize a whole registry page body. Unknown or malformed entries are
 * dropped one by one; a malformed body yields an empty page.
 */
export function normalizeRegistryPage(raw: unknown): {
  entries: CatalogEntry[]
  popularity: Map<string, number>
  nextCursor?: string
} {
  const entries: CatalogEntry[] = []
  const popularity = new Map<string, number>()
  if (!isRecord(raw)) return { entries, popularity }
  const page = raw as RawRegistryPage
  const list = Array.isArray(page.servers) ? page.servers : []
  for (const item of list) {
    try {
      const entry = normalizeRegistryServer(item)
      if (!entry) continue
      entries.push(entry)
      const { meta } = unwrapRegistryServer(item)
      const official = meta['io.modelcontextprotocol.registry/official']
      const isLatest = isRecord(official) && official.isLatest === true
      popularity.set(entry.id, isLatest ? 1 : 0)
    } catch {
      // Skip the entry; the rest of the page is still usable.
    }
  }
  const cursor = page.metadata?.nextCursor
  return {
    entries,
    popularity,
    ...(typeof cursor === 'string' && cursor.length > 0 ? { nextCursor: cursor } : {}),
  }
}

// ---------------------------------------------------------------------------
// Ranking + filtering
// ---------------------------------------------------------------------------

/** True when `text` names exactly this entry. */
export function isExactMatch(entry: CatalogEntry, text: string): boolean {
  const needle = text.trim().toLowerCase()
  if (!needle) return false
  return (
    entry.slug.toLowerCase() === needle ||
    entry.id.toLowerCase() === needle ||
    entry.title.toLowerCase() === needle
  )
}

function haystack(entry: CatalogEntry): string {
  return [
    entry.title,
    entry.slug,
    entry.description,
    entry.publisher,
    entry.categories.join(' '),
  ]
    .join(' ')
    .toLowerCase()
}

/**
 * Deterministic order: exact name match, then popularity (curated entries are
 * pinned at 1), then title, then id.
 */
export function rankEntries(
  entries: readonly CatalogEntry[],
  text: string,
  popularity: ReadonlyMap<string, number> = new Map(),
): CatalogEntry[] {
  const query = text.trim()
  return [...entries].sort((a, b) => {
    const exactA = isExactMatch(a, query) ? 0 : 1
    const exactB = isExactMatch(b, query) ? 0 : 1
    if (exactA !== exactB) return exactA - exactB
    const popA = popularity.get(a.id) ?? 0
    const popB = popularity.get(b.id) ?? 0
    if (popA !== popB) return popB - popA
    const titleA = a.title.toLowerCase()
    const titleB = b.title.toLowerCase()
    if (titleA !== titleB) return titleA < titleB ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

function matchesQuery(entry: CatalogEntry, query: CatalogQuery): boolean {
  if (query.source && entry.source !== query.source) return false
  if (query.category) {
    const wanted = query.category.toLowerCase()
    if (!entry.categories.some((category) => category.toLowerCase() === wanted)) return false
  }
  const text = query.text?.trim()
  if (text) {
    const tokens = text.toLowerCase().split(/\s+/).filter(Boolean)
    const body = haystack(entry)
    if (!tokens.every((token) => body.includes(token))) return false
  }
  return true
}

/** Key used to collapse a curated entry and its registry twin. */
export function dedupeKey(entry: CatalogEntry): string {
  if (entry.transport === 'streamable-http') {
    return `http:${(entry.url ?? '').toLowerCase().replace(/\/+$/, '')}`
  }
  const argv = [entry.command ?? '', ...(entry.args ?? [])]
    .join(' ')
    .toLowerCase()
    .replace(/@latest/g, '')
    .replace(/@\d[\w.-]*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return `stdio:${argv}`
}

// ---------------------------------------------------------------------------
// CatalogService
// ---------------------------------------------------------------------------

interface CacheEntry {
  at: number
  entries: CatalogEntry[]
  popularity: Map<string, number>
}

/**
 * Merges {@link CURATED_CATALOG} with the registry, caches registry pages,
 * and degrades to curated-only on any failure.
 */
export class CatalogService {
  private readonly registryUrl: string
  private readonly enabled: boolean
  private readonly fetchImpl: typeof fetch | undefined
  private readonly cacheTtlMs: number
  private readonly timeoutMs: number
  private readonly curated: readonly CatalogEntry[]
  private readonly pageLimit: number
  private readonly maxPages: number
  private readonly now: () => number

  private readonly cache = new Map<string, CacheEntry>()
  private lastRegistryEntries: CatalogEntry[] = []
  private lastRegistryPopularity = new Map<string, number>()
  private registryOnline = false

  constructor(options: CatalogOptions) {
    this.registryUrl = options.registryUrl
    this.enabled = options.enabled
    this.fetchImpl = options.fetchImpl
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.curated = options.curated ?? CURATED_CATALOG
    this.pageLimit = options.pageLimit ?? DEFAULT_PAGE_LIMIT
    this.maxPages = options.maxPages ?? DEFAULT_MAX_PAGES
    this.now = options.now ?? (() => Date.now())
  }

  /** Curated entries as shipped. */
  get curatedEntries(): CatalogEntry[] {
    return structuredClone([...this.curated])
  }

  /**
   * Synchronous lookup over the curated set plus the last cached registry
   * page. Returns undefined when the id is unknown. Never performs I/O.
   */
  findById(catalogId: string): CatalogEntry | undefined {
    const curated = this.curated.find(
      (entry) => entry.id === catalogId || entry.slug === catalogId,
    )
    if (curated) return structuredClone(curated)
    const fromRegistry = this.lastRegistryEntries.find((entry) => entry.id === catalogId)
    return fromRegistry ? structuredClone(fromRegistry) : undefined
  }

  /** Search curated + registry, ranked deterministically. */
  async search(query: CatalogQuery = {}): Promise<CatalogPage> {
    const curatedMatches = this.curated.filter((entry) => matchesQuery(entry, query))
    const curatedPopularity = new Map<string, number>()
    for (const entry of curatedMatches) curatedPopularity.set(entry.id, 1)

    let registryEntries: CatalogEntry[] = []
    let registryPopularity = new Map<string, number>()
    let registryError: string | undefined

    if (!this.enabled) {
      registryError = 'registry lookup disabled by configuration'
    } else if (query.source === 'curated') {
      registryEntries = this.lastRegistryEntries
      registryPopularity = this.lastRegistryPopularity
      if (!this.registryOnline) {
        registryError = 'registry not consulted for a curated-only query'
      }
    } else {
      try {
        const fetched = await this.fetchRegistry(query.text ?? '')
        registryEntries = fetched.entries
        registryPopularity = fetched.popularity
        this.lastRegistryEntries = fetched.entries
        this.lastRegistryPopularity = fetched.popularity
        this.registryOnline = true
      } catch (error) {
        registryError = error instanceof Error ? error.message : String(error)
        this.registryOnline = false
        registryEntries = []
        registryPopularity = new Map()
      }
    }

    const merged: CatalogEntry[] = []
    const seen = new Set<string>()
    for (const entry of [...curatedMatches, ...registryEntries]) {
      if (query.source && entry.source !== query.source) continue
      if (!query.source && entry.source !== 'curated' && !matchesQuery(entry, query)) continue
      const key = dedupeKey(entry)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(entry)
    }

    const popularity = new Map<string, number>([...registryPopularity, ...curatedPopularity])
    const ranked = rankEntries(merged, query.text ?? '', popularity)
    const limit =
      typeof query.limit === 'number' && query.limit >= 0
        ? Math.floor(query.limit)
        : DEFAULT_PAGE_LIMIT
    const entries = limit === 0 ? [] : ranked.slice(0, limit)

    return {
      entries,
      total: ranked.length,
      registryOnline: this.enabled && registryError === undefined,
      ...(registryError !== undefined ? { registryError } : {}),
    }
  }

  /** Categories present in the curated set and the latest registry result. */
  async categories(): Promise<string[]> {
    const page = await this.search({ limit: 200 })
    const categories = new Set<string>()
    for (const entry of [...page.entries, ...this.lastRegistryEntries]) {
      for (const category of entry.categories) categories.add(category.toLowerCase())
    }
    return [...categories].sort()
  }

  private async fetchRegistry(search: string): Promise<CacheEntry> {
    const cursorTrail: string[] = []
    let cursor: string | undefined
    const entries: CatalogEntry[] = []
    const popularity = new Map<string, number>()
    const deadline = this.now() + this.timeoutMs

    for (let page = 0; page < this.maxPages; page += 1) {
      const url = buildRegistryUrl(this.registryUrl, {
        search,
        limit: this.pageLimit,
        ...(cursor ? { cursor } : {}),
      })
      const cached = this.cache.get(url)
      const fresh = cached && this.now() - cached.at < this.cacheTtlMs ? cached : undefined
      let body: CacheEntry
      if (fresh) {
        body = fresh
      } else {
        const remaining = deadline - this.now()
        if (remaining <= 0) {
          throw new Error(`registry request timed out after ${this.timeoutMs}ms`)
        }
        const raw = await this.fetchJson(url, remaining)
        const normalized = normalizeRegistryPage(raw)
        body = {
          at: this.now(),
          entries: normalized.entries,
          popularity: normalized.popularity,
        }
        this.cache.set(url, body)
        if (normalized.nextCursor && !cursorTrail.includes(normalized.nextCursor)) {
          cursorTrail.push(normalized.nextCursor)
          cursor = normalized.nextCursor
        } else {
          cursor = undefined
        }
      }
      for (const entry of body.entries) {
        if (!entries.some((existing) => existing.id === entry.id)) entries.push(entry)
      }
      for (const [id, score] of body.popularity) {
        if (!popularity.has(id)) popularity.set(id, score)
      }
      if (!cursor) break
    }

    return { at: this.now(), entries, popularity }
  }

  private async fetchJson(url: string, timeoutMs: number): Promise<unknown> {
    const fetchImpl = this.fetchImpl ?? globalThis.fetch
    if (typeof fetchImpl !== 'function') {
      throw new Error('no fetch implementation available')
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), Math.max(1, timeoutMs))
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(`registry responded ${response.status} ${response.statusText}`.trim())
      }
      return await response.json()
    } finally {
      clearTimeout(timer)
    }
  }
}
