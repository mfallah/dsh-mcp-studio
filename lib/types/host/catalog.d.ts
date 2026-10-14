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
import { type CatalogEntry, type CatalogInput, type CatalogPage, type CatalogQuery } from '../shared/contract.js';
/** Registry path appended to the configured base URL. */
export declare const REGISTRY_PATH = "/v0.1/servers";
/** Registry page size requested per call. */
export declare const DEFAULT_PAGE_LIMIT = 50;
/** Registry pages fetched per search, at most. */
export declare const DEFAULT_MAX_PAGES = 2;
/** Cache lifetime for one registry response. */
export declare const DEFAULT_CACHE_TTL_MS: number;
/** Overall budget for one registry search, including every page. */
export declare const DEFAULT_TIMEOUT_MS = 6000;
export interface CatalogOptions {
    /** Base URL of the registry, e.g. `https://registry.modelcontextprotocol.io`. */
    registryUrl: string;
    /** When false the catalog is curated-only and no request is made. */
    enabled: boolean;
    /** Injected for tests. Defaults to `globalThis.fetch`. */
    fetchImpl?: typeof fetch;
    /** Registry response cache lifetime. Defaults to {@link DEFAULT_CACHE_TTL_MS}. */
    cacheTtlMs?: number;
    /** Overall registry budget. Defaults to {@link DEFAULT_TIMEOUT_MS}. */
    timeoutMs?: number;
    /** Curated entries, injected for tests. Defaults to the shipped set. */
    curated?: readonly CatalogEntry[];
    /** Page size per registry call. Defaults to {@link DEFAULT_PAGE_LIMIT}. */
    pageLimit?: number;
    /** Page cap per search. Defaults to {@link DEFAULT_MAX_PAGES}. */
    maxPages?: number;
    /** Clock, injected for tests. */
    now?: () => number;
}
/**
 * One entry of `server.packages[].environmentVariables[]` or
 * `server.packages[].arguments[]`. Both carry the same descriptive fields;
 * arguments additionally become `{input:key}` placeholders in the argv.
 */
export interface RawRegistryVariable {
    name?: string;
    description?: string;
    isRequired?: boolean;
    isSecret?: boolean;
    format?: string;
    choices?: string[];
    default?: unknown;
    placeholder?: string;
    /** Literal argv token for a fixed (unnamed) argument. */
    value?: string;
    type?: string;
}
export type RawEnvVar = RawRegistryVariable;
export type RawArgument = RawRegistryVariable;
export interface RawRegistryPackage {
    registryType?: string;
    identifier?: string;
    version?: string;
    runtimeHint?: string;
    transport?: {
        type?: string;
    };
    environmentVariables?: RawRegistryVariable[];
    arguments?: RawRegistryVariable[];
}
export interface RawRegistryRemote {
    /** The spec spells this `transportType`; older payloads used `type`. */
    transportType?: string;
    type?: string;
    url?: string;
}
export interface RawRegistryServer {
    name?: string;
    title?: string;
    description?: string;
    version?: string;
    websiteUrl?: string;
    repository?: {
        url?: string;
        source?: string;
    };
    icons?: {
        src?: string;
        mimeType?: string;
    }[];
    packages?: RawRegistryPackage[];
    remotes?: RawRegistryRemote[];
}
export interface RawRegistryWrapper {
    server?: RawRegistryServer;
    _meta?: Record<string, unknown>;
}
export interface RawRegistryPage {
    servers?: (RawRegistryServer | RawRegistryWrapper)[];
    metadata?: {
        nextCursor?: string | null;
        count?: number;
    };
}
/** Build the registry search URL for one page. */
export declare function buildRegistryUrl(registryUrl: string, options?: {
    search?: string;
    limit?: number;
    cursor?: string;
}): string;
/** Take the server object out of a v0.1 wrapper, or return it unchanged. */
export declare function unwrapRegistryServer(entry: RawRegistryServer | RawRegistryWrapper): {
    server: RawRegistryServer;
    meta: Record<string, unknown>;
};
/** `io.github.owner/repo` → `owner`-ish publisher label. */
export declare function publisherFrom(raw: RawRegistryServer): string;
/** Prettify the last path segment of a reverse-DNS registry name. */
export declare function titleFromName(name: string): string;
/**
 * Stable slug for a registry name: `io.github.owner/repo` →
 * `io-github-owner-repo`. Unlike the server-name slug it keeps up to 64
 * characters, so two servers in one namespace do not collapse together.
 */
export declare function slugifyRegistryName(name: string): string;
/**
 * Map one registry variable/argument into a {@link CatalogInput}.
 * `choices` has no contract field, so it is folded into the description.
 * Returns null when the entry has no usable name.
 */
export declare function inputFromVariable(raw: RawRegistryVariable): CatalogInput | null;
/**
 * One package → `{ command, args }` plus the inputs its arguments describe.
 * Returns null for a registry type we cannot launch today.
 */
export declare function launchFromPackage(pkg: RawRegistryPackage): {
    command: string;
    args: string[];
    inputs: CatalogInput[];
} | null;
/**
 * Normalize one v0.1 registry entry into a {@link CatalogEntry}.
 * Returns null when the entry has neither a launchable package nor a
 * Streamable HTTP remote, or when its shape is not understood.
 */
export declare function normalizeRegistryServer(entry: RawRegistryServer | RawRegistryWrapper): CatalogEntry | null;
/**
 * Normalize a whole registry page body. Unknown or malformed entries are
 * dropped one by one; a malformed body yields an empty page.
 */
export declare function normalizeRegistryPage(raw: unknown): {
    entries: CatalogEntry[];
    popularity: Map<string, number>;
    nextCursor?: string;
};
/** True when `text` names exactly this entry. */
export declare function isExactMatch(entry: CatalogEntry, text: string): boolean;
/**
 * Deterministic order: exact name match, then popularity (curated entries are
 * pinned at 1), then title, then id.
 */
export declare function rankEntries(entries: readonly CatalogEntry[], text: string, popularity?: ReadonlyMap<string, number>): CatalogEntry[];
/** Key used to collapse a curated entry and its registry twin. */
export declare function dedupeKey(entry: CatalogEntry): string;
/**
 * Merges {@link CURATED_CATALOG} with the registry, caches registry pages,
 * and degrades to curated-only on any failure.
 */
export declare class CatalogService {
    private readonly registryUrl;
    private readonly enabled;
    private readonly fetchImpl;
    private readonly cacheTtlMs;
    private readonly timeoutMs;
    private readonly curated;
    private readonly pageLimit;
    private readonly maxPages;
    private readonly now;
    private readonly cache;
    private lastRegistryEntries;
    private lastRegistryPopularity;
    private registryOnline;
    constructor(options: CatalogOptions);
    /** Curated entries as shipped. */
    get curatedEntries(): CatalogEntry[];
    /**
     * Synchronous lookup over the curated set plus the last cached registry
     * page. Returns undefined when the id is unknown. Never performs I/O.
     */
    findById(catalogId: string): CatalogEntry | undefined;
    /** Search curated + registry, ranked deterministically. */
    search(query?: CatalogQuery): Promise<CatalogPage>;
    /** Categories present in the curated set and the latest registry result. */
    categories(): Promise<string[]>;
    private fetchRegistry;
    private fetchJson;
}
