/**
 * Small presentational atoms for the MCP Studio panel.
 *
 * No component library is imported: the panel ships its own parts and styles
 * through `styles.ts`, so the bundle has exactly two externals (react and
 * react/jsx-runtime) and nothing else can break composition.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/parts/base
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { ServerStatus } from '../../../shared/contract.js'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant
  /** Renders a pending glyph and blocks a second click. */
  busy?: boolean
  /** Accessible name for an icon-only control. */
  label?: string
  icon?: ReactNode
  children?: ReactNode
}

/** A real `<button>` that refuses double submits and always has a name. */
export function Button({ variant = 'secondary', busy = false, label, icon, children, ...rest }: ButtonProps) {
  const iconOnly = children === undefined || children === null || children === false || children === ''
  return (
    <button
      {...rest}
      type={rest.type ?? 'button'}
      className="mcp-btn"
      data-variant={variant}
      data-busy={busy ? 'true' : 'false'}
      data-icon-only={iconOnly ? 'true' : 'false'}
      aria-label={label ?? rest['aria-label']}
      aria-busy={busy || undefined}
      disabled={rest.disabled || busy}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {iconOnly ? null : <span>{children}</span>}
    </button>
  )
}

export type TagTone = 'neutral' | 'ok' | 'warn' | 'error' | 'info'

/** A compact metadata badge. */
export function Tag({ tone = 'neutral', children }: { tone?: TagTone; children: ReactNode }) {
  return (
    <span className="mcp-tag" data-tone={tone}>
      {children}
    </span>
  )
}

/** A toggleable filter chip; `aria-pressed` carries the state. */
export function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" className="mcp-chip" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  )
}

/**
 * Connection status, never colour-only: a glyph plus the translated label.
 */
export function StatusDot({ status, label }: { status: ServerStatus; label: string }) {
  const glyph: Record<ServerStatus, string> = {
    connected: '●',
    connecting: '◐',
    error: '▲',
    disabled: '○',
    stopped: '■',
  }
  return (
    <span className="mcp-status" data-state={status}>
      <span className="mcp-status-glyph" aria-hidden="true">
        {glyph[status]}
      </span>
      <span>{label}</span>
    </span>
  )
}
