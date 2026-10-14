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
export const THEME_TOKEN_SOURCE = '@deepseek-ai/dsh-client-ui-theme/lib/client.js'

/** Every harness theme custom property the panel's stylesheet may reference. */
export const DSH_THEME_TOKENS: readonly string[] = [
  // Surfaces -----------------------------------------------------------------
  '--dsw-alias-bg-base',
  '--dsw-alias-bg-layer-1',
  '--dsw-alias-bg-layer-2',
  '--dsw-alias-bg-layer-3',
  '--dsw-alias-bg-mask-1',
  '--dsw-alias-markdown-code-block',

  // Borders ------------------------------------------------------------------
  '--dsw-alias-border-l1',
  '--dsw-alias-border-l2',
  '--dsw-alias-border-l3',

  // Text ---------------------------------------------------------------------
  '--dsw-alias-label-primary',
  '--dsw-alias-label-primary-foreground',
  '--dsw-alias-label-secondary',
  '--dsw-alias-label-tertiary',

  // Interactive --------------------------------------------------------------
  '--dsw-alias-state-business-primary',
  '--dsw-alias-interactive-bg-hover',
  '--dsw-alias-interactive-bg-hover-danger',
  '--dsw-alias-button-primary-fill',
  '--dsw-alias-button-primary-hover',
  '--dsw-alias-button-ghost-active-fill',

  // Status -------------------------------------------------------------------
  '--dsw-alias-state-success-primary',
  '--dsw-alias-state-warn-primary',
  '--dsw-alias-state-error-primary',

  // Elevation, geometry, focus, type ----------------------------------------
  '--dsw-elevation-panel',
  '--dsw-shadow-lv2',
  '--dsw-mask-blur',
  '--dsw-radius-sm',
  '--dsw-radius-md',
  '--dsw-radius-panel',
  '--dsw-focus-ring-color',
  '--dsw-focus-ring-width',
  '--dsw-font-family',
]

/** Fast membership test for the audit and for reviewers reading this module. */
export const DSH_THEME_TOKEN_SET: ReadonlySet<string> = new Set(DSH_THEME_TOKENS)

/** Every `--dsw-…` name a stylesheet references, deduplicated, in source order. */
export function usedThemeTokens(css: string): string[] {
  const found = css.match(/--dsw-[A-Za-z0-9-]+/g) ?? []
  return [...new Set(found)]
}

/**
 * The referenced tokens this panel is not allowed to use.
 *
 * @param css - any stylesheet text.
 * @returns the offending names; empty means the stylesheet is clean.
 */
export function unknownThemeTokens(css: string): string[] {
  return usedThemeTokens(css).filter((token) => !DSH_THEME_TOKEN_SET.has(token))
}

/**
 * A `var(--dsw-x, <fallback>)` is only acceptable when the fallback is not a
 * theme value: radii and the font stack are plain CSS, and the focus ring falls
 * back to another real token. Any other fallback is a hidden theme — exactly
 * how an invented token once rendered the panel dark in light mode.
 */
const FALLBACK_ALLOWED = [
  /^--dsw-radius-(xs|sm|md|lg|xl|panel)$/,
  /^--dsw-font-family$/,
  /^--dsw-focus-ring-color$/,
]

/**
 * Find every theme token that is wrapped in a fallback value.
 *
 * @param css - any stylesheet text.
 * @returns the offending `var(--dsw-…)` uses, with their fallback text.
 */
export function themeTokensWithFallback(css: string): Array<{ token: string; fallback: string }> {
  const out: Array<{ token: string; fallback: string }> = []
  for (const match of css.matchAll(/var\((--dsw-[A-Za-z0-9-]+)\s*,\s*([^)]*)\)/g)) {
    const token = match[1]
    const fallback = match[2]
    if (token === undefined || fallback === undefined) continue
    if (FALLBACK_ALLOWED.some((pattern) => pattern.test(token))) continue
    out.push({ token, fallback: fallback.trim() })
  }
  return out
}
