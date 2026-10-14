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
import type { CatalogPage, CatalogQuery, LogChunk, McpStudioApi, ProbeResult, ResolutionReport, RuntimeReport, ServerConfig, ServerDetail, ServerDraft, ServerPatch, ServerView } from '../shared/contract.js';
import type { ConnectionSupervisor } from './connection.js';
import type { CatalogService } from './catalog.js';
import type { LogBuffer } from './logs.js';
import type { SecretStore } from './secrets.js';
import type { ServerStore } from './store.js';
/** An error with a stable machine-readable code the UI can branch on. */
export declare class McpStudioError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
/** Everything the service needs, all injected so tests can substitute. */
export interface ServiceDeps {
    store: ServerStore;
    secrets: SecretStore;
    logs: LogBuffer;
    catalog: CatalogService;
    supervisor: ConnectionSupervisor;
    env: NodeJS.ProcessEnv;
    /** Budget for a pre-save connection probe. */
    probeTimeoutMs: number;
    /** Reports a state change to the plugin's event emitter. */
    onChange: (ids: string[], reason: 'added' | 'updated' | 'removed' | 'status') => void;
    /** Package version, reported by the export header. */
    version: string;
}
/**
 * The MCP Studio host service.
 *
 * Not a Cordis service: it is created by the plugin and handed to the HTTP
 * dispatcher directly. Keeping it a plain class means every method is unit
 * testable without a Cordis runtime.
 */
export declare class McpStudioService implements McpStudioApi {
    private readonly deps;
    private runtimeCache;
    constructor(deps: ServiceDeps);
    private requireConfig;
    private view;
    /** Turn a validated draft into a persistable config. */
    private draftToConfig;
    /** Build a config for a draft without persisting it, for probes. */
    private draftToProbeConfig;
    listServers(): Promise<ServerView[]>;
    getServer(id: string): Promise<ServerDetail | null>;
    addServer(draft: ServerDraft): Promise<ServerView>;
    updateServer(id: string, patch: ServerPatch): Promise<ServerView>;
    removeServer(id: string): Promise<void>;
    setEnabled(id: string, enabled: boolean): Promise<ServerView>;
    restartServer(id: string): Promise<ServerView>;
    testConnection(draft: ServerDraft): Promise<ProbeResult>;
    getLogs(id: string, sinceSeq: number): Promise<LogChunk>;
    catalog(query: CatalogQuery): Promise<CatalogPage>;
    catalogCategories(): Promise<string[]>;
    /** Turn a catalog entry plus filled values into an installable draft. */
    installFromCatalog(catalogId: string, values: Record<string, string>): Promise<ServerDraft>;
    private catalogEntrySync;
    detectRuntimes(): Promise<RuntimeReport>;
    listSecretNames(): Promise<string[]>;
    setSecret(name: string, value: string): Promise<void>;
    deleteSecret(name: string): Promise<void>;
    resolveConfig(draft: ServerDraft): Promise<ResolutionReport>;
    exportPatch(): Promise<string>;
    /** Configs whose env/headers reference one secret name. */
    referencesTo(name: string): ServerConfig[];
    /** Mount every enabled server; used once at plugin startup. */
    mountAll(): Promise<void>;
    /** Redacted env/header map for a server, for the settings pane. */
    redacted(config: ServerConfig): Record<string, string>;
    /** One-line reason a config would fail to connect right now, or '' when fine. */
    precondition(config: ServerConfig): string;
}
