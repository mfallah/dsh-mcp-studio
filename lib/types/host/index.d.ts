import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** Plugin name used by loader diagnostics. */
export declare const name = "mcp-studio";
/**
 * Version reported to the UI and the health endpoint.
 * Kept in sync with package.json by `tests/host/version.test.ts`.
 */
export declare const VERSION = "0.1.0";
/** Package name, used in the health response and the export header. */
export declare const PACKAGE_NAME = "@mfallah/dsh-mcp-studio";
/**
 * Cordis config schema.
 *
 * Every field has a default so the bundle layer in `patch.yml` can mount the
 * plugin with no configuration at all.
 */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    /** Override the store directory. Empty means `$DSH_HOME/mcp-studio`. */
    storeDir: z<string, string, "defined">;
    /** Query the official MCP registry in addition to the curated catalog. */
    catalogEnabled: z<boolean, boolean, "defined">;
    /** Registry API base URL. */
    registryUrl: z<string, string, "defined">;
    /** Budget for a pre-save connection probe. */
    probeTimeoutMs: z<number, number, "defined">;
    /** Budget for mounting one real server at startup. */
    mountTimeoutMs: z<number, number, "defined">;
    /** Retained log lines per server. */
    logLinesPerServer: z<number, number, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    /** Override the store directory. Empty means `$DSH_HOME/mcp-studio`. */
    storeDir: z<string, string, "defined">;
    /** Query the official MCP registry in addition to the curated catalog. */
    catalogEnabled: z<boolean, boolean, "defined">;
    /** Registry API base URL. */
    registryUrl: z<string, string, "defined">;
    /** Budget for a pre-save connection probe. */
    probeTimeoutMs: z<number, number, "defined">;
    /** Budget for mounting one real server at startup. */
    mountTimeoutMs: z<number, number, "defined">;
    /** Retained log lines per server. */
    logLinesPerServer: z<number, number, "defined">;
}>>, "plain">;
/** Resolved plugin configuration. */
export interface Config {
    storeDir: string;
    catalogEnabled: boolean;
    registryUrl: string;
    probeTimeoutMs: number;
    mountTimeoutMs: number;
    logLinesPerServer: number;
}
/** Where the plugin keeps its state by default. */
export declare function defaultStoreDir(env?: NodeJS.ProcessEnv): string;
/**
 * Mount MCP Studio.
 *
 * Startup order matters and is deliberate: the stores load first so a corrupt
 * file is reported before anything is served, the HTTP route is registered next
 * so the panel can render a "connecting" row immediately, and only then are the
 * configured servers mounted. A server that fails to connect is reported as a
 * row error and never aborts plugin activation.
 *
 * @param ctx - the plugin context.
 * @param config - validated plugin configuration.
 */
export declare function apply(ctx: Context, config: Config): Promise<void>;
