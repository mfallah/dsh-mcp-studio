/**
 * A copyable block of generated text (the exported patch).
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/parts/CodeBlock
 */
import { useState } from 'react'
import { Button } from './base.js'

/**
 * Render `code` in a `<pre>` with a copy button.
 *
 * @param props.code - the text to show and copy.
 * @param props.copyLabel - button label before copying.
 * @param props.copiedLabel - confirmation after a successful copy.
 * @param props.failedLabel - what to say when the clipboard API is unavailable.
 */
export function CodeBlock({
  code,
  copyLabel,
  copiedLabel,
  failedLabel,
}: {
  code: string
  copyLabel: string
  copiedLabel: string
  failedLabel: string
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const copy = async () => {
    try {
      const clipboard = globalThis.navigator?.clipboard
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('no clipboard')
      await clipboard.writeText(code)
      setState('copied')
    } catch {
      setState('failed')
    }
  }

  return (
    <div className="mcp-stack" style={{ gap: 6 }}>
      <div className="mcp-row">
        <Button variant="secondary" onClick={() => void copy()}>
          {copyLabel}
        </Button>
        <span className="mcp-hint" role="status" aria-live="polite">
          {state === 'copied' ? copiedLabel : state === 'failed' ? failedLabel : ''}
        </span>
      </div>
      <pre className="mcp-code" tabIndex={0}>
        {code}
      </pre>
    </div>
  )
}
