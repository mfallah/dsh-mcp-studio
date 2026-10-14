/**
 * A modal sheet: Escape closes it, focus starts inside, Tab stays inside, and
 * the backdrop is a real button so pointer users can dismiss it too.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/parts/Overlay
 */
import { useEffect, useRef, type ReactNode } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Render a modal overlay.
 *
 * @param props.title - visible heading, wired as the dialog's accessible name.
 * @param props.onClose - called on Escape, backdrop click, and the close button.
 * @param props.closeLabel - accessible name for the close control.
 * @param props.footer - optional action row pinned under the body.
 * @param props.wide - use the wider sheet for the server drawer.
 */
export function Overlay({
  title,
  subtitle,
  onClose,
  closeLabel,
  children,
  footer,
  wide = false,
  titleId,
}: {
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  closeLabel: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  titleId?: string
}) {
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const headingId = titleId ?? 'mcp-sheet-title'

  useEffect(() => {
    const node = sheetRef.current
    const first = node?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? node)?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !node) return
      const focusable = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      )
      const firstElement = focusable[0]
      const lastElement = focusable[focusable.length - 1]
      if (!firstElement || !lastElement) return
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  return (
    <div className="mcp-overlay">
      <div
        className="mcp-sheet"
        data-wide={wide ? 'true' : 'false'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        ref={sheetRef}
        tabIndex={-1}
      >
        <div className="mcp-sheet-head">
          <div className="mcp-stack" style={{ gap: 2 }}>
            <h2 id={headingId}>{title}</h2>
            {subtitle ? <p className="mcp-hint">{subtitle}</p> : null}
          </div>
          <button type="button" className="mcp-btn mcp-close" aria-label={closeLabel} onClick={onClose}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div className="mcp-sheet-body">{children}</div>
        {footer ? <div className="mcp-sheet-foot">{footer}</div> : null}
      </div>
    </div>
  )
}
