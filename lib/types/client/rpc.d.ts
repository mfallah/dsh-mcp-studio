/**
 * The single seam between the MCP Studio UI and the host half.
 *
 * The host exposes exactly one route — `POST /mcp-studio-api/rpc` — carrying
 * `{ method, args }`; this module is the only place that knows that wire
 * format. Every call the panel makes goes through the `McpStudioApi`-shaped
 * facade returned by {@link createStudioApi}, so tests inject a fake by
 * passing a `transport` and any change to the RPC convention touches this file
 * alone. Components import `McpStudioApi` (types only) and never call `fetch`.
 *
 * @module @mfallah/dsh-mcp-studio/client/rpc
 */
import type { McpStudioApi } from '../shared/contract.js';
/** Route the host half registers on `ctx.webServer`. */
export declare const RPC_PATH = "/mcp-studio-api/rpc";
/** Header the host uses to reject drive-by requests from other origins. */
export declare const RPC_HEADER = "x-mcp-studio";
/** One wire call: method name plus positional arguments. */
export type RpcTransport = (method: string, args: unknown[]) => Promise<unknown>;
/** Failure from the host route, carrying the machine-readable code when present. */
export declare class StudioRpcError extends Error {
    /** Machine-readable class from the host envelope, when it supplied one. */
    readonly code?: string;
    /** HTTP status of the failing response, when the failure was transport-level. */
    readonly status?: number;
    constructor(message: string, options?: {
        code?: string;
        status?: number;
    });
}
/** Options accepted by {@link createStudioApi}. */
export interface StudioApiOptions {
    /** Route override; defaults to {@link RPC_PATH}. */
    url?: string;
    /** Fetch implementation; defaults to the page's global fetch. */
    fetch?: typeof globalThis.fetch;
    /** Extra headers merged over the plugin's own. */
    headers?: Record<string, string>;
    /** Pre-built transport, for tests. When present the fetch path is not used. */
    transport?: RpcTransport;
}
/**
 * Build the HTTP transport the facade speaks over.
 *
 * Sends `{ method, args }`, requires a `2xx` with a JSON `{ ok }` envelope,
 * and turns `{ ok: false }` into a {@link StudioRpcError} carrying `code`.
 *
 * @param options - route, fetch implementation, and extra headers.
 * @returns a transport function usable by {@link createStudioApi}.
 */
export declare function createHttpTransport(options?: StudioApiOptions): RpcTransport;
/**
 * Build the typed facade the UI consumes.
 *
 * Method names map one-to-one onto the wire, so the host half can dispatch on
 * `method` directly.
 *
 * @param options - transport override plus HTTP options.
 * @returns the `McpStudioApi` facade; every method rejects with
 *   {@link StudioRpcError} when the route is unavailable or the call fails.
 */
export declare function createStudioApi(options?: StudioApiOptions): McpStudioApi;
/** Human-readable message for anything a rejected promise can carry. */
export declare function errorMessage(error: unknown): string;
