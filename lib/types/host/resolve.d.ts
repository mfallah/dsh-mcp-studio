/**
 * Placeholder resolution for MCP server env vars and HTTP headers.
 *
 * Two placeholder forms are accepted anywhere inside a value:
 *
 *   `${env:NAME}`     read from the process environment
 *   `${secret:NAME}`  read from the plugin's own secret store
 *
 * They may stand alone (`"${secret:GITHUB_TOKEN}"`) or be embedded in a longer
 * literal (`"Bearer ${secret:GITHUB_TOKEN}"`), because the embedded form is what
 * real MCP servers ask for in an `Authorization` header.
 *
 * Resolution NEVER throws. A missing name is collected into the report so the
 * caller can show the user exactly which value to fill in, instead of failing a
 * connection with an opaque error from deep inside the MCP SDK.
 *
 * @module @mfallah/dsh-mcp-studio/host/resolve
 */
import type { ResolutionReport } from '../shared/contract.js';
/** The two lookup sources a placeholder can read from. */
export interface ResolveContext {
    env: NodeJS.ProcessEnv;
    secrets: {
        get(name: string): string | undefined;
    };
}
/** One resolved value map plus what could not be resolved. */
export interface ResolvedMap {
    values: Record<string, string>;
    report: ResolutionReport;
}
/** Every placeholder name appearing in one value, in order of appearance. */
export declare function placeholdersIn(value: string): Array<{
    kind: 'env' | 'secret';
    name: string;
}>;
/** True when a value contains at least one placeholder. */
export declare function hasPlaceholder(value: string): boolean;
/**
 * Replace every placeholder in one value.
 * @param value - the configured value, literal or templated.
 * @param context - environment and secret lookups.
 * @param missing - accumulator for unresolvable names, mutated in place.
 * @returns the expanded value; unresolved placeholders are left verbatim so the
 *   failure is visible in a log line rather than silently becoming empty text.
 */
export declare function expandValue(value: string, context: ResolveContext, missing: {
    env: Set<string>;
    secret: Set<string>;
}): string;
/**
 * Expand a whole env or headers map.
 * @param input - the configured map; `undefined` reads as empty.
 * @param context - environment and secret lookups.
 * @returns resolved values plus the report the UI renders.
 */
export declare function resolveMap(input: Record<string, string> | undefined, context: ResolveContext): ResolvedMap;
/** Human-readable one-liner for a resolution failure, used in logs and probes. */
export declare function describeMissing(report: ResolutionReport): string;
/** Secret NAMES referenced by a map, without expanding anything. */
export declare function secretNamesIn(input: Record<string, string> | undefined): string[];
/** Whether any value in a map references the secret store. */
export declare function usesSecrets(input: Record<string, string> | undefined): boolean;
/**
 * A display-safe copy of an env or header map.
 *
 * Secret-backed values keep their placeholder (it names the secret, never its
 * value). A value whose KEY looks like a credential but that is a plain literal
 * is masked, because the store may hold a value the user pasted in by accident.
 * Everything else is shown as-is: a command-line environment is not secret by
 * default and hiding it would make the settings pane useless.
 */
export declare function redactMap(input: Record<string, string> | undefined): Record<string, string>;
