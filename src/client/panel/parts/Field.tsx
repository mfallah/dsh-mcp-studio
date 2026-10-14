/**
 * Accessible form fields: one label, one control, hints and errors wired to
 * `aria-describedby`, and no `placeholder` standing in for a label.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/parts/Field
 */
import { useId, type ReactNode } from 'react'

interface CommonFieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  disabled?: boolean
  id?: string
}

function describedBy(base: string, hasHint: boolean, hasError: boolean): string | undefined {
  const ids: string[] = []
  if (hasHint) ids.push(`${base}-hint`)
  if (hasError) ids.push(`${base}-error`)
  return ids.length > 0 ? ids.join(' ') : undefined
}

/** One-line text input (also used for numbers and passwords via `type`). */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  type = 'text',
  disabled,
  required,
  readOnly,
  mono,
  id,
  autoFocus,
  inputMode,
}: CommonFieldProps & {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'number' | 'password' | 'url'
  required?: boolean
  readOnly?: boolean
  mono?: boolean
  autoFocus?: boolean
  inputMode?: 'text' | 'numeric' | 'url'
}) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <div className="mcp-field">
      <label className="mcp-label" htmlFor={fieldId}>
        {label}
        {required ? <span aria-hidden="true">*</span> : null}
      </label>
      <input
        id={fieldId}
        className="mcp-input"
        style={mono ? { fontFamily: "'Cascadia Mono', ui-monospace, monospace", direction: 'ltr' } : undefined}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        autoFocus={autoFocus}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, Boolean(hint), Boolean(error))}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? (
        <p className="mcp-hint" id={`${fieldId}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="mcp-field-error" id={`${fieldId}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Multi-line input, monospaced by default because most here are config blobs. */
export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  disabled,
  rows = 4,
  id,
}: CommonFieldProps & {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <div className="mcp-field">
      <label className="mcp-label" htmlFor={fieldId}>
        {label}
      </label>
      <textarea
        id={fieldId}
        className="mcp-textarea"
        rows={rows}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, Boolean(hint), Boolean(error))}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? (
        <p className="mcp-hint" id={`${fieldId}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="mcp-field-error" id={`${fieldId}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Native select; the option list is translated by the caller. */
export function SelectField({
  label,
  value,
  onChange,
  options,
  hint,
  disabled,
  id,
}: CommonFieldProps & {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  const generated = useId()
  const fieldId = id ?? generated
  return (
    <div className="mcp-field">
      <label className="mcp-label" htmlFor={fieldId}>
        {label}
      </label>
      <select
        id={fieldId}
        className="mcp-select"
        value={value}
        disabled={disabled}
        aria-describedby={hint ? `${fieldId}-hint` : undefined}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p className="mcp-hint" id={`${fieldId}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** A labelled checkbox used for booleans and per-row secret markers. */
export function CheckboxField({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: ReactNode
  checked: boolean
  onChange: (checked: boolean) => void
  hint?: ReactNode
  disabled?: boolean
}) {
  const generated = useId()
  return (
    <div className="mcp-field">
      <label className="mcp-check" htmlFor={generated}>
        <input
          id={generated}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        {label}
      </label>
      {hint ? <p className="mcp-hint">{hint}</p> : null}
    </div>
  )
}
