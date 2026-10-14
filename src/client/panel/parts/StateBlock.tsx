/**
 * The one way this panel renders a state it cannot satisfy.
 *
 * Empty, loading, error and offline all say what is happening and what to do
 * next; there is deliberately no bare spinner.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/parts/StateBlock
 */
import type { ReactNode } from 'react'
import { Button } from './base.js'

export type StateTone = 'empty' | 'loading' | 'error' | 'offline'

/**
 * Render a titled state card.
 *
 * @param props.tone - drives the border and the live-region role.
 * @param props.title - what is happening, in one line.
 * @param props.body - why, and what the user can do about it.
 * @param props.action - optional next step rendered as a real button.
 */
export function StateBlock({
  tone,
  title,
  body,
  action,
}: {
  tone: StateTone
  title: ReactNode
  body: ReactNode
  action?: { label: string; onClick: () => void; busy?: boolean }
}) {
  return (
    <div
      className="mcp-state"
      data-tone={tone}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      <p className="mcp-state-title">{title}</p>
      <p className="mcp-state-body">{body}</p>
      {action ? (
        <Button variant="secondary" onClick={action.onClick} busy={action.busy}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}
