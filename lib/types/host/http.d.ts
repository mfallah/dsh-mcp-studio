/**
 * The host's local HTTP surface for the browser half.
 *
 * A third-party DSH client plugin cannot reliably reach its own host half over
 * the built-in Typert RPC: `@deepseek-ai/dsh-api-remotes` fixes the reachable
 * capability set from build-time imports, and forwarded events need an entry in
 * its own allowlist. `ctx.webServer` is the documented, plugin-facing
 * alternative — "feature plugins claim their routes" — so the panel talks to
 * one JSON endpoint here instead.
 *
 * Wire contract (frozen; the client's `rpc.ts` is the only consumer):
 *
 *   GET  /mcp-studio-api/health
 *        -> 200 { ok: true, name, version, servers }
 *
 *   POST /mcp-studio-api/rpc      header: x-mcp-studio: 1
 *        body     { method: "<McpStudioApi method>", args: [...] }
 *        -> 200 { ok: true,  value: <result> }
 *        -> 200 { ok: false, error: { message, code?, data? } }
 *
 * Failures the caller can fix (bad config, missing secret, unreachable server)
 * are answered as `ok: false` with status 200 so the browser always reads a
 * body. Only protocol-level mistakes — wrong path, wrong method, missing guard
 * header, cross-origin, oversized or malformed body — use a 4xx status.
 *
 * Security posture:
 * - The route lives under its own `/mcp-studio-api` prefix, outside `/api`, so
 *   it neither depends on nor weakens the harness's browser-trust fence.
 * - The server binds loopback only by default (`dsh-host-webserver` config).
 * - The `x-mcp-studio` header is mandatory. It is not a secret; its job is to
 *   force a CORS preflight, so a random web page cannot drive this API with a
 *   simple (non-preflighted) cross-origin POST.
 * - Requests carrying an `Origin` that is not this exact host are rejected, and
 *   `Sec-Fetch-Site` is rejected unless it is `same-origin` or `none`.
 *
 * @module @mfallah/dsh-mcp-studio/host/http
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
/** Path prefix this plugin owns. Never collides with `/api` or `/plugins`. */
export declare const API_PREFIX = "/mcp-studio-api";
/**
 * The slice of `ctx.webServer` this module uses.
 *
 * Structural rather than an import of `@deepseek-ai/dsh-host-webserver`, so the
 * plugin does not need that package's types to compile and still works when the
 * route is registered by a compatible server.
 */
export interface WebServerLike {
    register(route: {
        kind: 'exact' | 'prefix';
        path: string;
        handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
    }): () => void;
}
/** Header the client must send. Forces a preflight for cross-origin callers. */
export declare const CLIENT_HEADER = "x-mcp-studio";
/** RPC handler signature: one method name plus positional arguments. */
export type RpcDispatch = (method: string, args: unknown[]) => Promise<unknown>;
/** Facts the health endpoint reports, so an installer can verify the plugin. */
export interface ApiFacts {
    name: string;
    version: string;
    serverCount: () => number;
}
/**
 * Register the MCP Studio HTTP surface on the harness web server.
 * @param webServer - the route registry (`ctx.webServer`).
 * @param dispatch - runs one `McpStudioApi` method; throws are reported as `ok: false`.
 * @param facts - identity and liveness data for the health endpoint.
 * @returns the route disposer.
 */
export declare function registerApi(webServer: WebServerLike, dispatch: RpcDispatch, facts: ApiFacts): () => void;
