/**
 * Editors for the two repeated shapes in every server config: an ordered
 * argument list, and a key/value map whose values may be secrets.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/parts/Editors
 */
import type { Translate } from '../../locales/keys.js'
import { Button } from './base.js'

let rowSeq = 0

/** One editable map entry; ids keep React keys stable across edits. */
export interface KeyValueRow {
  id: string
  key: string
  value: string
  /** When true the value is a `${secret:KEY}` reference, not a literal. */
  secret: boolean
}

/** Create an empty row with a fresh stable id. */
export function createKeyValueRow(): KeyValueRow {
  rowSeq += 1
  return { id: `kv-${rowSeq}`, key: '', value: '', secret: false }
}

/**
 * Edit an ordered list of argument strings.
 *
 * @param props.values - the current arguments, in order.
 * @param props.onChange - called with the whole new list.
 * @param props.label - group label; also names the add control.
 */
export function ArgListEditor({
  values,
  onChange,
  label,
  addLabel,
  t,
}: {
  values: string[]
  onChange: (values: string[]) => void
  label: string
  addLabel: string
  t: Translate
}) {
  const update = (index: number, value: string) => {
    const next = [...values]
    next[index] = value
    onChange(next)
  }
  return (
    <div className="mcp-field">
      <span className="mcp-label">{label}</span>
      <div className="mcp-kv">
        {values.map((value, index) => (
          <div className="mcp-arg-row" key={`arg-${index}`}>
            <input
              className="mcp-input mcp-mono"
              value={value}
              aria-label={`${label} ${index + 1}`}
              onChange={(event) => update(index, event.target.value)}
            />
            <Button
              variant="ghost"
              label={`${t('delete')}: ${label} ${index + 1}`}
              onClick={() => onChange(values.filter((_, position) => position !== index))}
            >
              ✕
            </Button>
          </div>
        ))}
        <div>
          <Button variant="ghost" onClick={() => onChange([...values, ''])}>
            {addLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Edit a key/value map with per-row secret marking.
 *
 * A row marked secret is rendered as a password field and the caller converts
 * it into a `${secret:KEY}` placeholder before sending it to the host; the
 * literal value never lands in `servers.json`.
 */
export function KeyValueEditor({
  rows,
  onChange,
  label,
  addLabel,
  keyPlaceholder,
  valuePlaceholder,
  secretLabel,
  t,
}: {
  rows: KeyValueRow[]
  onChange: (rows: KeyValueRow[]) => void
  label: string
  addLabel: string
  keyPlaceholder: string
  valuePlaceholder: string
  secretLabel: string
  t: Translate
}) {
  const update = (id: string, patch: Partial<KeyValueRow>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }
  return (
    <div className="mcp-field">
      <span className="mcp-label">{label}</span>
      <div className="mcp-kv">
        {rows.map((row, index) => (
          <div className="mcp-kv-row" key={row.id}>
            <input
              className="mcp-input mcp-mono"
              value={row.key}
              placeholder={keyPlaceholder}
              aria-label={`${label} ${keyPlaceholder} ${index + 1}`}
              onChange={(event) => update(row.id, { key: event.target.value })}
            />
            <input
              className="mcp-input mcp-mono"
              value={row.value}
              type={row.secret ? 'password' : 'text'}
              placeholder={valuePlaceholder}
              aria-label={`${label} ${valuePlaceholder} ${index + 1}`}
              onChange={(event) => update(row.id, { value: event.target.value })}
            />
            <label className="mcp-check">
              <input
                type="checkbox"
                checked={row.secret}
                aria-label={`${secretLabel}: ${row.key || index + 1}`}
                onChange={(event) => update(row.id, { secret: event.target.checked })}
              />
              {secretLabel}
            </label>
            <Button
              variant="ghost"
              label={`${t('delete')}: ${row.key || label}`}
              onClick={() => onChange(rows.filter((candidate) => candidate.id !== row.id))}
            >
              ✕
            </Button>
          </div>
        ))}
        <div>
          <Button variant="ghost" onClick={() => onChange([...rows, createKeyValueRow()])}>
            {addLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
