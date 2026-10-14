/**
 * The harness theme tokens this panel is allowed to use.
 *
 * These names are copied verbatim from the shipped theme package:
 * `@deepseek-ai/dsh-client-ui-theme/lib/client.js`, which defines them on
 * `body` (403 `--dsw-*` custom properties in the installed build). The panel
 * inherits them, so everything it paints follows the harness Appearance
 * setting — light or dark — with no fallbacks of our own.
 *
 * This list exists to be enforced, not to be admired: `styles.ts` may only
 * reference tokens named here, and `tests/client/theme-tokens.test.ts` fails on
 * anything else. The failure mode it prevents is specific and was real — an
 * invented token name (`--dsw-surface-base`) with a dark `var()` fallback made
 * the whole panel render dark in light mode, silently, for a long time.
 *
 * Adding a token here is a deliberate act: find it in the theme package first.
 *
 * @module @mfallah/dsh-mcp-studio/client/theme-tokens
 */
/** Where the names below come from (for maintainers, not read at runtime). */
export declare const THEME_TOKEN_SOURCE = "@deepseek-ai/dsh-client-ui-theme/lib/client.js";
/** Every harness theme custom property the panel's stylesheet may reference. */
export declare const DSH_THEME_TOKENS: readonly string[];
/** Fast membership test for the audit and for reviewers reading this module. */
export declare const DSH_THEME_TOKEN_SET: ReadonlySet<string>;
/** Every `--dsw-…` name a stylesheet references, deduplicated, in source order. */
export declare function usedThemeTokens(css: string): string[];
/**
 * The referenced tokens this panel is not allowed to use.
 *
 * @param css - any stylesheet text.
 * @returns the offending names; empty means the stylesheet is clean.
 */
export declare function unknownThemeTokens(css: string): string[];
/**
 * Find every theme token that is wrapped in a fallback value.
 *
 * @param css - any stylesheet text.
 * @returns the offending `var(--dsw-…)` uses, with their fallback text.
 */
export declare function themeTokensWithFallback(css: string): Array<{
    token: string;
    fallback: string;
}>;
