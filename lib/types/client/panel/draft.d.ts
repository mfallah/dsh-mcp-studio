/**
 * Turning what the forms collect into what the host expects.
 *
 * Catalog templating is NOT done here: `installFromCatalog(catalogId, values)`
 * runs the `{input:key}` substitution and the secret routing on the host, so
 * those rules live in exactly one place. This module owns the form-side shape of
 * the secret convention and re-exports the naming rules from `secrets.ts`.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/draft
 */
import type { CatalogEntry, McpTransport, ServerConfig } from '../../shared/contract.js';
import type { SecretWrite } from '../secrets.js';
import type { KeyValueRow } from './parts/Editors.js';
export { isSecretReference, secretInputWrites, secretNameFor, secretReference } from '../secrets.js';
export type { SecretWrite } from '../secrets.js';
/**
 * The answers with every raw secret replaced by its `${secret:key}` reference.
 *
 * The host's `installFromCatalog` validates required inputs before it builds
 * the draft, so a stored secret must stay in the map — as a reference, never as
 * the literal value.
 */
export declare function sealedCatalogValues(entry: CatalogEntry, values: Record<string, string>): Record<string, string>;
/**
 * True when every required input has a value.
 *
 * Purely a form affordance: it disables the Install button with an explanation.
 * The host re-validates the same rule when it builds the draft.
 */
export declare function catalogInputsSatisfied(entry: CatalogEntry, values: Record<string, string>): boolean;
/** Split editor rows into a plain record plus the secrets they contain. */
export declare function rowsToRecord(rows: KeyValueRow[], prefix: string): {
    record: Record<string, string>;
    secrets: SecretWrite[];
};
/**
 * Replace each stored secret row's raw value with its `${secret:name}`, so the
 * raw value cannot be echoed back by a later render while a repeat submit still
 * produces the same env/header entry.
 */
export declare function sealSecretRows(rows: KeyValueRow[], prefix: string, stored: Set<string>): KeyValueRow[];
/** Render a persisted env/header record back into editor rows. */
export declare function recordToRows(record: Record<string, string>, nextId: () => string): KeyValueRow[];
/** Which env/header keys a config carries, for the settings summary. */
export declare function configMapKeys(config: ServerConfig): string[];
/** Transport label key shared by several views. */
export declare function transportLabel(transport: McpTransport): 'catalogTransportStdio' | 'catalogTransportHttp';
