/**
 * A `role="tablist"` built from real buttons, usable with the keyboard.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/parts/Tabs
 */
export interface TabItem<T extends string> {
  id: T
  label: string
}

/**
 * Render the tab strip.
 *
 * @param props.items - tab ids and their already-translated labels.
 * @param props.active - the selected tab id.
 * @param props.onChange - called with the newly selected id.
 * @param props.label - accessible name for the strip itself.
 */
export function Tabs<T extends string>({
  items,
  active,
  onChange,
  label,
}: {
  items: Array<TabItem<T>>
  active: T
  onChange: (id: T) => void
  label: string
}) {
  return (
    <div className="mcp-tabs" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          id={`mcp-tab-${item.id}`}
          className="mcp-tab"
          aria-selected={item.id === active}
          aria-controls={`mcp-tabpanel-${item.id}`}
          tabIndex={item.id === active ? 0 : -1}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
            event.preventDefault()
            const index = items.findIndex((candidate) => candidate.id === item.id)
            const delta = event.key === 'ArrowRight' ? 1 : -1
            const next = items[(index + delta + items.length) % items.length]
            if (next) onChange(next.id)
          }}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
