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
import type { CatalogEntry, McpTransport, ServerConfig } from '../../shared/contract.js'
import { isSecretReference, secretNameFor, secretReference } from '../secrets.js'
import type { SecretWrite } from '../secrets.js'
import type { KeyValueRow } from './parts/Editors.js'

export { isSecretReference, secretInputWrites, secretNameFor, secretReference } from '../secrets.js'
export type { SecretWrite } from '../secrets.js'

/**
 * The answers with every raw secret replaced by its `${secret:key}` reference.
 *
 * The host's `installFromCatalog` validates required inputs before it builds
 * the draft, so a stored secret must stay in the map — as a reference, never as
 * the literal value.
 */
export function sealedCatalogValues(entry: CatalogEntry, values: Record<string, string>): Record<string, string> {
  const next = { ...values }
  for (const input of entry.inputs) {
    if (!input.secret) continue
    const value = next[input.key]?.trim() ?? ''
    if (value === '' || isSecretReference(value)) continue
    next[input.key] = secretReference(input.key)
  }
  return next
}

/**
 * True when every required input has a value.
 *
 * Purely a form affordance: it disables the Install button with an explanation.
 * The host re-validates the same rule when it builds the draft.
 */
export function catalogInputsSatisfied(entry: CatalogEntry, values: Record<string, string>): boolean {
  return entry.inputs
    .filter((input) => input.required)
    .every((input) => {
      const typed = values[input.key]
      return (typed !== undefined && typed.trim() !== '') || (input.defaultValue ?? '') !== ''
    })
}

/** Split editor rows into a plain record plus the secrets they contain. */
export function rowsToRecord(
  rows: KeyValueRow[],
  prefix: string,
): { record: Record<string, string>; secrets: SecretWrite[] } {
  const record: Record<string, string> = {}
  const secrets: SecretWrite[] = []
  for (const row of rows) {
    const key = row.key.trim()
    if (key === '') continue
    const value = row.value
    if (row.secret && value !== '' && !isSecretReference(value)) {
      const name = secretNameFor(prefix, key)
      secrets.push({ name, value })
      record[key] = secretReference(name)
    } else if (value !== '') {
      record[key] = value
    }
  }
  return { record, secrets }
}

/**
 * Replace each stored secret row's raw value with its `${secret:name}`, so the
 * raw value cannot be echoed back by a later render while a repeat submit still
 * produces the same env/header entry.
 */
export function sealSecretRows(rows: KeyValueRow[], prefix: string, stored: Set<string>): KeyValueRow[] {
  return rows.map((row) => {
    if (!row.secret || row.value === '' || isSecretReference(row.value)) return row
    const name = secretNameFor(prefix, row.key.trim())
    if (!stored.has(name)) return row
    return { ...row, value: secretReference(name), secret: false }
  })
}

/** Render a persisted env/header record back into editor rows. */
export function recordToRows(record: Record<string, string>, nextId: () => string): KeyValueRow[] {
  return Object.entries(record).map(([key, value]) => ({
    id: nextId(),
    key,
    value,
    secret: isSecretReference(value),
  }))
}

/** Which env/header keys a config carries, for the settings summary. */
export function configMapKeys(config: ServerConfig): string[] {
  return config.transport === 'stdio' ? Object.keys(config.env) : Object.keys(config.headers)
}

/** Transport label key shared by several views. */
export function transportLabel(transport: McpTransport): 'catalogTransportStdio' | 'catalogTransportHttp' {
  return transport === 'stdio' ? 'catalogTransportStdio' : 'catalogTransportHttp'
}
