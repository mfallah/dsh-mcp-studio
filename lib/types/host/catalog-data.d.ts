/**
 * The curated, offline catalog.
 *
 * Every entry here works without the official MCP registry. Package names and
 * versions were verified against `https://registry.npmjs.org` (npm) and
 * `https://pypi.org` (uvx) while writing this file; launch flags were verified
 * against each vendor's README. Entries whose launch convention could not be
 * confirmed against vendor documentation are marked `// UNVERIFIED` inline and
 * carry that fact in their description.
 *
 * Conventions used by {@link entryToDraft}:
 * - `{input:key}` appears only in `command`, `args` and `url`.
 * - A `secret: true` input that the template does not mention becomes an env
 *   (stdio) or header (http) entry named by the input key, with the value
 *   `${secret:<key>}`.
 * - For header-based servers the input key is the header name; the stored
 *   secret value must include any `Bearer ` prefix, because the contract's
 *   secret placeholder is anchored and cannot be embedded in a longer string.
 *
 * @module @mfallah/dsh-mcp-studio/host/catalog-data
 */
import type { CatalogEntry } from '../shared/contract.js';
/** Bump when the curated set changes shape or contents meaningfully. */
export declare const CATALOG_DATA_VERSION = 1;
/**
 * The curated catalog. Every entry is tagged with its own slug so the client's
 * filter chips (`filesystem`, `playwright`, …) have a stable lowercase id.
 */
export declare const CURATED_CATALOG: readonly CatalogEntry[];
/** A defensive copy of the curated catalog, safe for callers to mutate. */
export declare function curatedCatalog(): CatalogEntry[];
/** Look up one curated entry by slug. */
export declare function curatedBySlug(slug: string): CatalogEntry | undefined;
