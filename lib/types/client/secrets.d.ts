/**
 * The client's half of the secret convention.
 *
 * The host never writes a secret for the catalog path — `installFromCatalog` is
 * a pure transformation — so the value has to be stored by the client, under
 * its own explicit call, before a draft that references it is tested or added.
 * These helpers keep the naming and reference rules in one place:
 *
 *   - a catalog secret is stored under `input.key` verbatim, which is exactly
 *     what the host substitutes into `${secret:<key>}`;
 *   - a manual env/header secret is stored under a sanitized `<server>.<KEY>`;
 *   - a value that already is a `${secret:...}` reference is never re-written,
 *     or the real secret would be overwritten by its own placeholder.
 *
 * @module @mfallah/dsh-mcp-studio/client/secrets
 */
import type { CatalogEntry } from '../shared/contract.js';
/** One secret value to store before a draft can reference it. */
export interface SecretWrite {
    name: string;
    value: string;
}
/** True when the value is already a secret reference rather than a literal. */
export declare function isSecretReference(value: string): boolean;
/** The exact reference string the host and the supervisor both understand. */
export declare function secretReference(name: string): string;
/** Make a value safe for the secret-name grammar `[A-Za-z0-9._-]{1,64}`. */
export declare function secretNameFor(prefix: string, key: string): string;
/**
 * The secret values a catalog entry's answers still need written.
 *
 * @param entry - the catalog entry being installed.
 * @param values - what the user typed, keyed by input key.
 * @returns one write per secret input with a raw, non-empty answer.
 */
export declare function secretInputWrites(entry: CatalogEntry, values: Record<string, string>): SecretWrite[];
