/**
 * The token audit.
 *
 * This is the test whose absence let the panel ship dark in light mode: every
 * `--dsw-*` name in the stylesheet was invented, each `var()` fell through to a
 * hardcoded dark fallback, and nothing failed. From now on a misspelled token in
 * `STUDIO_CSS` breaks CI.
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { STUDIO_CSS } from '../../src/client/styles.js'
import {
  DSH_THEME_TOKENS,
  DSH_THEME_TOKEN_SET,
  themeTokensWithFallback,
  unknownThemeTokens,
  usedThemeTokens,
} from '../../src/client/theme-tokens.js'

/** Locate the shipped theme package on this machine, if it is installed. */
function findThemePackage(): string | null {
  const relative = join(
    'profiles',
    'node_modules',
    '@deepseek-ai',
    'dsh-client-ui-theme',
    'lib',
    'client.js',
  )
  const candidates = [
    process.env.DSH_HOME ? join(process.env.DSH_HOME, relative) : null,
    join(homedir(), '.dsh', relative),
  ].filter((candidate): candidate is string => candidate !== null)
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

/** Names the theme package actually defines (as opposed to merely references). */
function definedThemeTokens(source: string): Set<string> {
  const defined = new Set<string>()
  for (const match of source.matchAll(/(--dsw-[A-Za-z0-9-]+)\s*:/g)) {
    if (match[1] !== undefined) defined.add(match[1])
  }
  return defined
}

const themePackage = findThemePackage()

describe('stylesheet token audit', () => {
  it('references at least one theme token, so the audit cannot pass vacuously', () => {
    expect(usedThemeTokens(STUDIO_CSS).length).toBeGreaterThan(20)
  })

  it('uses only tokens declared in theme-tokens.ts', () => {
    const unknown = usedThemeTokens(STUDIO_CSS).filter((token) => !DSH_THEME_TOKEN_SET.has(token))
    expect(unknown).toEqual([])
  })

  it('declares exactly the tokens the stylesheet uses', () => {
    const used = usedThemeTokens(STUDIO_CSS)
    const declaredButUnused = DSH_THEME_TOKENS.filter((token) => !used.includes(token))
    expect(declaredButUnused).toEqual([])
  })

  it('never hides a theme colour behind a fallback', () => {
    const offenders = themeTokensWithFallback(STUDIO_CSS).map(
      ({ token, fallback }) => `var(${token}, ${fallback})`,
    )
    expect(offenders).toEqual([])
  })

  it('actually catches a misspelled token and a hidden fallback', () => {
    // Guards the guard: the audit must fail on the exact shape of the bug.
    expect(unknownThemeTokens('.x { color: var(--dsw-surface-base, #14161a); }')).toEqual([
      '--dsw-surface-base',
    ])
    expect(unknownThemeTokens('.x { color: var(--dsw-alias-label-primary); }')).toEqual([])
    expect(themeTokensWithFallback('.x { color: var(--dsw-alias-label-primary, #fff); }')).toEqual([
      { token: '--dsw-alias-label-primary', fallback: '#fff' },
    ])
    expect(themeTokensWithFallback('.x { border-radius: var(--dsw-radius-md, 10px); }')).toEqual([])
  })

  it('contains no colour literals', () => {
    expect(STUDIO_CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(STUDIO_CSS).not.toMatch(/\brgba?\(/)
    expect(STUDIO_CSS).not.toMatch(/\bhsla?\(/)
  })

  it('keeps the invented names of the original bug out of the allow-list', () => {
    for (const invented of [
      '--dsw-surface-base',
      '--dsw-surface-raised',
      '--dsw-surface-sunken',
      '--dsw-border-subtle',
      '--dsw-border-default',
      '--dsw-text-primary',
      '--dsw-text-secondary',
      '--dsw-text-tertiary',
      '--dsw-accent',
      '--dsw-status-success',
      '--dsw-status-warning',
      '--dsw-status-danger',
    ]) {
      expect(DSH_THEME_TOKEN_SET.has(invented), invented).toBe(false)
    }
  })

  it('keeps the panel scoped, Vazirmatn-first, RTL-safe and focus-visible', () => {
    expect(STUDIO_CSS).toContain('.mcp-studio')
    expect(STUDIO_CSS).toContain('Vazirmatn')
    expect(STUDIO_CSS).toContain('margin-inline-start')
    expect(STUDIO_CSS).toContain(':focus-visible')
    expect(STUDIO_CSS).toContain('var(--mcp-focus-ring-width)')
  })

  it('resolves the focus ring on the focused element, so the harness pointer rule still wins', () => {
    // `html[data-input-modality=pointer] body :focus-visible` sets
    // `--dsw-focus-ring-color: transparent` on the element itself; an alias
    // computed once on `.mcp-studio` would freeze the keyboard colour and show
    // a ring for mouse users, so the token must be read inside the rule.
    const rule = STUDIO_CSS.match(/:focus-visible\s*\{[\s\S]*?\}/)?.[0] ?? ''
    expect(rule).toContain('var(--dsw-focus-ring-color,')
    expect(STUDIO_CSS).not.toContain('--mcp-focus-ring-color')
  })
})

describe.skipIf(themePackage === null)('theme package provenance', () => {
  it('every declared token is a custom property the theme package defines', () => {
    const defined = definedThemeTokens(readFileSync(themePackage as string, 'utf8'))
    expect(defined.size).toBeGreaterThan(300)
    const missing = DSH_THEME_TOKENS.filter((token) => !defined.has(token))
    expect(missing).toEqual([])
  })

  it('the stylesheet uses no token that the theme package fails to define', () => {
    const defined = definedThemeTokens(readFileSync(themePackage as string, 'utf8'))
    const missing = usedThemeTokens(STUDIO_CSS).filter((token) => !defined.has(token))
    expect(missing).toEqual([])
  })
})
