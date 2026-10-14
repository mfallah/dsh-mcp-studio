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

import {
  SECRET_PLACEHOLDER,
  slugifyServerName,
  type CatalogEntry,
  type CatalogInput,
  type ServerDraft,
} from '../shared/contract.js'

/** Default per-call timeout for a freshly installed server. */
export const DEFAULT_TOOL_CALL_TIMEOUT_MS = 60_000

/** Raised when an entry cannot be turned into a draft. */
export class CatalogInputError extends Error {
  readonly code: 'missing' | 'invalid'
  /** Input keys that caused the failure. */
  readonly keys: string[]

  constructor(code: 'missing' | 'invalid', message: string, keys: string[] = []) {
    super(message)
    this.name = 'CatalogInputError'
    this.code = code
    this.keys = keys
  }
}

const PLACEHOLDER_RE = /\{input:([^}]+)\}/g

/** Secret-store name for one input. Secret inputs are keyed by input key. */
export function secretNameFor(input: CatalogInput): string {
  const name = input.key
  if (!SECRET_PLACEHOLDER.test(`\${secret:${name}}`)) {
    throw new CatalogInputError(
      'invalid',
      `input '${name}' cannot be used as a secret name`,
      [name],
    )
  }
  return name
}

/** The `{input:key}` placeholders an entry's template actually mentions. */
export function templateInputKeys(entry: CatalogEntry): string[] {
  const keys: string[] = []
  const collect = (value: string | undefined): void => {
    if (value === undefined) return
    for (const match of value.matchAll(PLACEHOLDER_RE)) {
      const key = match[1]
      if (key && !keys.includes(key)) keys.push(key)
    }
  }
  collect(entry.command)
  collect(entry.url)
  for (const arg of entry.args ?? []) collect(arg)
  return keys
}

function isUsable(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0
}

/**
 * Validate the user's answers against `entry.inputs`.
 * Returns one message per offending input key; an empty object means valid
 * and the entry can be installed.
 */
export function validateCatalogValues(
  entry: CatalogEntry,
  values: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {}
  const supplied = values ?? {}

  for (const input of entry.inputs) {
    const raw = supplied[input.key]
    if (!isUsable(raw)) {
      if (input.required && !isUsable(input.defaultValue)) {
        errors[input.key] = `${input.label} is required`
      }
      continue
    }
    const value = raw.trim()
    if (input.format === 'number' && !Number.isFinite(Number(value))) {
      errors[input.key] = `${input.label} must be a number`
    } else if (input.format === 'boolean' && value !== 'true' && value !== 'false') {
      errors[input.key] = `${input.label} must be true or false`
    }
  }

  const known = new Set(entry.inputs.map((input) => input.key))
  for (const key of templateInputKeys(entry)) {
    if (!known.has(key)) {
      errors[key] = `catalog entry references unknown input '${key}'`
    }
  }
  return errors
}

/** Resolve one input to its effective value: supplied, else default. */
function resolveValue(
  input: CatalogInput,
  values: Record<string, string>,
): string | undefined {
  const supplied = values[input.key]
  if (isUsable(supplied)) return supplied.trim()
  return isUsable(input.defaultValue) ? input.defaultValue.trim() : undefined
}

function effectiveValues(
  entry: CatalogEntry,
  values: Record<string, string>,
): Record<string, string> {
  const errors = validateCatalogValues(entry, values)
  const errorKeys = Object.keys(errors)
  if (errorKeys.length > 0) {
    const missing = entry.inputs.filter(
      (input) => errors[input.key] !== undefined && input.required,
    )
    if (missing.length > 0) {
      throw new CatalogInputError(
        'missing',
        `missing required input(s): ${missing.map((input) => input.key).join(', ')}`,
        missing.map((input) => input.key),
      )
    }
    throw new CatalogInputError('invalid', `invalid input(s): ${errorKeys.join(', ')}`, errorKeys)
  }

  const out: Record<string, string> = {}
  for (const input of entry.inputs) {
    const value = resolveValue(input, values)
    if (value !== undefined) out[input.key] = value
  }
  return out
}

function substitute(
  template: string,
  values: Record<string, string>,
  inputsByKey: Map<string, CatalogInput>,
): string {
  return template.replace(PLACEHOLDER_RE, (_match, key: string) => {
    const input = inputsByKey.get(key)
    if (!input) {
      throw new CatalogInputError('invalid', `catalog entry references unknown input '${key}'`, [key])
    }
    const value = values[key]
    if (input.secret) return `\${secret:${secretNameFor(input)}}`
    return value ?? ''
  })
}

/**
 * True when an argv token mentions an optional input the user left empty.
 * Such a token is dropped whole, so `--local-timezone={input:tz}` never turns
 * into a dangling `--local-timezone=`.
 */
function hasUnfilledPlaceholder(
  token: string,
  values: Record<string, string>,
  inputsByKey: Map<string, CatalogInput>,
): boolean {
  for (const match of token.matchAll(PLACEHOLDER_RE)) {
    const key = match[1]
    if (!key) continue
    const input = inputsByKey.get(key)
    if (!input || input.secret) continue
    if (values[key] === undefined) return true
  }
  return false
}

/**
 * The secret values the user supplied for this entry, keyed by secret name.
 * Callers persist these through the secret store; they never enter the draft.
 */
export function secretValuesFor(
  entry: CatalogEntry,
  values: Record<string, string>,
): Record<string, string> {
  const resolved = effectiveValues(entry, values)
  const out: Record<string, string> = {}
  for (const input of entry.inputs) {
    if (!input.secret) continue
    const value = resolved[input.key]
    if (value !== undefined) out[secretNameFor(input)] = value
  }
  return out
}

/** Build the draft the UI sends to `addServer` / `testConnection`. */
export function entryToDraft(entry: CatalogEntry, values: Record<string, string>): ServerDraft {
  const resolved = effectiveValues(entry, values)
  const inputsByKey = new Map(entry.inputs.map((input) => [input.key, input] as const))
  const referenced = new Set(templateInputKeys(entry))

  const draft: ServerDraft = {
    transport: entry.transport,
    title: entry.title,
    ...(entry.description ? { description: entry.description } : {}),
    serverName: slugifyServerName(entry.slug || entry.title),
    // Carry the provenance across the boundary, so an entry installed from the
    // catalog still reads as a catalog entry in the panel instead of looking
    // hand-written. `addServer` persists these onto the row.
    source: entry.source === 'registry' ? 'registry' : 'curated',
    catalogId: entry.id,
    ...(entry.homepage ? { homepage: entry.homepage } : {}),
    failOnStartupError: false,
    toolCallTimeoutMs: DEFAULT_TOOL_CALL_TIMEOUT_MS,
  }

  if (entry.transport === 'stdio') {
    if (!entry.command) {
      throw new CatalogInputError('invalid', `catalog entry '${entry.id}' has no command`, [])
    }
    draft.command = substitute(entry.command, resolved, inputsByKey)
    if (draft.command.includes('{input:')) {
      throw new CatalogInputError(
        'missing',
        `catalog entry '${entry.id}' needs an unresolved input in its command`,
        [],
      )
    }
    draft.args = (entry.args ?? [])
      .filter((arg) => !hasUnfilledPlaceholder(arg, resolved, inputsByKey))
      .map((arg) => substitute(arg, resolved, inputsByKey))
    const env: Record<string, string> = {}
    for (const input of entry.inputs) {
      if (referenced.has(input.key)) continue
      const value = resolved[input.key]
      if (value === undefined) continue
      env[input.key] = input.secret ? `\${secret:${secretNameFor(input)}}` : value
    }
    if (Object.keys(env).length > 0) draft.env = env
    return draft
  }

  if (!entry.url) {
    throw new CatalogInputError('invalid', `catalog entry '${entry.id}' has no url`, [])
  }
  draft.url = substitute(entry.url, resolved, inputsByKey)
  if (draft.url.includes('{input:')) {
    throw new CatalogInputError(
      'missing',
      `catalog entry '${entry.id}' needs an unresolved input in its url`,
      [],
    )
  }
  const headers: Record<string, string> = {}
  for (const input of entry.inputs) {
    if (referenced.has(input.key)) continue
    const value = resolved[input.key]
    if (value === undefined) continue
    headers[input.key] = input.secret ? `\${secret:${secretNameFor(input)}}` : value
  }
  if (Object.keys(headers).length > 0) draft.headers = headers
  return draft
}
