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
import type { Context, Fiber } from '@deepseek-ai/cordis';
import type { ServerConfig, ServerStatus } from '../shared/contract.js';
import type { LogBuffer } from './logs.js';
import { type ResolveContext } from './resolve.js';
/** The slice of `ctx.tools` this supervisor reads. Structural, so no hard dep. */
export interface ToolSchemaSource {
    schemas(scope?: unknown): Array<{
        name: string;
    }>;
}
/** Live state of one server, owned by the supervisor. */
export interface MountedState {
    config: ServerConfig;
    fiber: Fiber | null;
    status: ServerStatus;
    lastError?: string;
    connectedAt?: string;
    /** Raw tool names discovered under this server's namespace. */
    tools: string[];
}
export interface SupervisorOptions {
    ctx: Context;
    logs: LogBuffer;
    resolve: ResolveContext;
    /** Reads the live tool registry; `undefined` until the tools service appears. */
    tools: () => ToolSchemaSource | undefined;
    /** Called after any status change so the plugin can notify the UI. */
    onChange: (id: string) => void;
    /** Extra time allowed for one mount attempt beyond the per-call timeout. */
    mountTimeoutMs?: number;
}
/** Error code used when the MCP bridge package itself cannot be loaded. */
export declare class BridgeMissingError extends Error {
    readonly code = "bridge-missing";
    constructor(cause: unknown);
}
/** Error code used when a config still has unresolved placeholders. */
export declare class UnresolvedConfigError extends Error {
    readonly code = "unresolved-config";
    constructor(message: string);
}
/**
 * Turn any thrown value into a one-line message worth showing a user.
 *
 * The bridge wraps the real cause in a generic "initial connection or tool
 * synchronization failed" error, so the chain is walked and joined. Without
 * this a missing executable reads as an unexplained failure, and the UI cannot
 * tell the user which command to install.
 */
export declare function errorMessage(error: unknown): string;
/**
 * Owns the live connection of every configured MCP server.
 *
 * One instance per plugin load. It holds no persistence — the store does — and
 * never edits configuration. Every public method is safe to call concurrently:
 * mounting the same id twice serializes through an internal per-id chain.
 */
export declare class ConnectionSupervisor {
    private readonly ctx;
    private readonly logs;
    private readonly resolve;
    private readonly tools;
    private readonly onChange;
    private readonly mountTimeoutMs;
    private readonly states;
    /** Serializes mount/unmount per server id, so two UI clicks cannot race. */
    private readonly chains;
    private bridge;
    private disposed;
    constructor(options: SupervisorOptions);
    /** Run `work` after every previously queued operation for `id`. */
    private serialize;
    /** Live state for one server, or `undefined` when it was never mounted. */
    state(id: string): MountedState | undefined;
    /** Status for a config row: a disabled row never has a live state. */
    status(config: ServerConfig): ServerStatus;
    /** Raw tool names discovered under one server namespace. */
    toolsFor(serverName: string): string[];
    /** Load the bridge module once; throws {@link BridgeMissingError} when absent. */
    private loadBridge;
    /** Build the bridge config, expanding placeholders and reporting misses. */
    private bridgeConfig;
    /**
     * Mount one server. Idempotent per id: mounting again replaces the previous
     * instance after disposing it. Never throws for a server-side failure — the
     * failure is recorded on the returned state.
     * @param config - the persisted server row.
     * @returns the resulting live state.
     */
    mount(config: ServerConfig): Promise<MountedState>;
    /** Establish the connection for an already-registered state. */
    private connect;
    private disabledState;
    /** Dispose one live fiber without touching queued work. */
    private unmountNow;
    /** Disconnect one server and forget its live state. */
    unmount(id: string): Promise<void>;
    /** Disconnect and reconnect one server, keeping its stored config. */
    restart(config: ServerConfig): Promise<MountedState>;
    /** Refresh the cached tool list of one already-connected server. */
    refreshTools(id: string): string[];
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
    probe(draft: ServerConfig, timeoutMs: number): Promise<{
        ok: boolean;
        error?: string;
        tools: string[];
        serverInfo?: {
            name: string;
            version: string;
        };
    }>;
    /** Dispose every live server and refuse further mounts. */
    dispose(): Promise<void>;
}
/** One-line description of where a config connects, for logs. */
export declare function describeConfig(config: ServerConfig): string;
