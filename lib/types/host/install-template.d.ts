/**
 * Catalog entry → server draft.
 *
 * A catalog entry is a template: `command`, `args` and `url` may contain
 * `{input:key}` placeholders, and `inputs` describes what the user must
 * supply. This module turns that template plus the user's answers into a
 * {@link ServerDraft}:
 *
 * - `secret: true` inputs never become literals. When the placeholder appears
 *   in the template it is replaced with `${secret:<key>}`; when it does not,
 *   the input key becomes an env (stdio) or header (http) whose value is
 *   `${secret:<key>}`. The caller stores the value through the secret store.
 * - Every other input becomes a literal, either substituted into the template
 *   or, when the template never mentions it, an env/header entry.
 * - `defaultValue` stands in for an input the user left empty.
 *
 * @module @mfallah/dsh-mcp-studio/host/install-template
 */
import { type CatalogEntry, type CatalogInput, type ServerDraft } from '../shared/contract.js';
/** Default per-call timeout for a freshly installed server. */
export declare const DEFAULT_TOOL_CALL_TIMEOUT_MS = 60000;
/** Raised when an entry cannot be turned into a draft. */
export declare class CatalogInputError extends Error {
    readonly code: 'missing' | 'invalid';
    /** Input keys that caused the failure. */
    readonly keys: string[];
    constructor(code: 'missing' | 'invalid', message: string, keys?: string[]);
}
/** Secret-store name for one input. Secret inputs are keyed by input key. */
export declare function secretNameFor(input: CatalogInput): string;
/** The `{input:key}` placeholders an entry's template actually mentions. */
export declare function templateInputKeys(entry: CatalogEntry): string[];
/**
 * Validate the user's answers against `entry.inputs`.
 * Returns one message per offending input key; an empty object means valid
 * and the entry can be installed.
 */
export declare function validateCatalogValues(entry: CatalogEntry, values: Record<string, string>): Record<string, string>;
/**
 * The secret values the user supplied for this entry, keyed by secret name.
 * Callers persist these through the secret store; they never enter the draft.
 */
export declare function secretValuesFor(entry: CatalogEntry, values: Record<string, string>): Record<string, string>;
/** Build the draft the UI sends to `addServer` / `testConnection`. */
export declare function entryToDraft(entry: CatalogEntry, values: Record<string, string>): ServerDraft;
