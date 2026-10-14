/**
 * The panel's stylesheet, as one injected `<style>` element.
 *
 * Everything is scoped under `.mcp-studio` and every colour reads a `--dsw-*`
 * token first, with a dark-theme fallback, so the panel looks native in the
 * harness and still renders standalone in tests. Logical properties
 * (`margin-inline`, `padding-inline`, `inset-inline`) keep the layout correct
 * in both directions, since the panel flips to RTL for Persian.
 *
 * @module @mfallah/dsh-mcp-studio/client/styles
 */

/** Attribute marking the element we injected, so re-apply is idempotent. */
const STYLE_ATTR = 'data-mcp-studio-styles'

/** The complete stylesheet. */
export const STUDIO_CSS = `
.mcp-studio {
  --mcp-bg: var(--dsw-surface-base, #14161a);
  --mcp-raised: var(--dsw-surface-raised, #1b1e24);
  --mcp-sunken: var(--dsw-surface-sunken, #101216);
  --mcp-border: var(--dsw-border-subtle, #2a2f37);
  --mcp-border-strong: var(--dsw-border-default, #3a414c);
  --mcp-text: var(--dsw-text-primary, #e6e8ec);
  --mcp-muted: var(--dsw-text-secondary, #9aa2ad);
  --mcp-faint: var(--dsw-text-tertiary, #6d7580);
  --mcp-accent: var(--dsw-accent, #4c8dff);
  --mcp-accent-soft: color-mix(in srgb, var(--mcp-accent) 18%, transparent);
  --mcp-ok: var(--dsw-status-success, #35c07a);
  --mcp-warn: var(--dsw-status-warning, #e2b23c);
  --mcp-error: var(--dsw-status-danger, #e5534b);
  --mcp-radius: 10px;
  --mcp-radius-sm: 6px;
  --mcp-gap: 12px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--mcp-bg);
  color: var(--mcp-text);
  font-family: Vazirmatn, 'Vazirmatn Variable', -apple-system, 'Segoe UI', system-ui, sans-serif;
  font-size: 13.5px;
  line-height: 1.65;
}
.mcp-studio *, .mcp-studio *::before, .mcp-studio *::after { box-sizing: border-box; }
.mcp-studio :focus-visible {
  outline: 2px solid var(--mcp-accent);
  outline-offset: 2px;
  border-radius: 4px;
}
.mcp-studio h1 { font-size: 1.25rem; margin: 0; font-weight: 650; }
.mcp-studio h2 { font-size: 1rem; margin: 0; font-weight: 600; }
.mcp-studio code, .mcp-studio pre, .mcp-studio .mcp-mono {
  font-family: 'Cascadia Mono', 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.85em;
  direction: ltr;
  unicode-bidi: plaintext;
}

/* Header ------------------------------------------------------------------ */
.mcp-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--mcp-border);
  background: var(--mcp-raised);
}
.mcp-header-top { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.mcp-header-titles { display: flex; flex-direction: column; gap: 2px; flex: 1 1 240px; min-width: 0; }
.mcp-subtitle { color: var(--mcp-muted); margin: 0; }
.mcp-header-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.mcp-tabs { display: flex; gap: 4px; border-bottom: 1px solid transparent; }

/* Toolbar / body ---------------------------------------------------------- */
.mcp-body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 16px 20px 32px; }
.mcp-stack { display: flex; flex-direction: column; gap: var(--mcp-gap); }
.mcp-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.mcp-grow { flex: 1 1 auto; min-width: 0; }
.mcp-muted { color: var(--mcp-muted); }
.mcp-faint { color: var(--mcp-faint); }
.mcp-wrap { overflow-wrap: anywhere; }

/* Buttons ----------------------------------------------------------------- */
.mcp-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: var(--mcp-radius-sm);
  border: 1px solid var(--mcp-border-strong);
  background: var(--mcp-raised);
  color: var(--mcp-text);
  padding: 5px 11px;
  font: inherit;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}
.mcp-btn:hover:not(:disabled) { border-color: var(--mcp-accent); }
.mcp-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.mcp-btn[data-variant='primary'] { background: var(--mcp-accent); border-color: var(--mcp-accent); color: #fff; }
.mcp-btn[data-variant='ghost'] { background: transparent; border-color: transparent; color: var(--mcp-muted); }
.mcp-btn[data-variant='ghost']:hover:not(:disabled) { background: var(--mcp-sunken); color: var(--mcp-text); }
.mcp-btn[data-variant='danger'] { border-color: var(--mcp-error); color: var(--mcp-error); background: transparent; }
.mcp-btn[data-variant='danger']:hover:not(:disabled) { background: color-mix(in srgb, var(--mcp-error) 14%, transparent); }
.mcp-btn[data-icon-only='true'] { padding: 5px 7px; }
.mcp-btn[data-busy='true'] { cursor: progress; }

/* Tabs -------------------------------------------------------------------- */
.mcp-tab {
  border: none;
  background: transparent;
  color: var(--mcp-muted);
  border-bottom: 2px solid transparent;
  padding: 6px 12px;
  font: inherit;
  cursor: pointer;
}
.mcp-tab[aria-selected='true'] { color: var(--mcp-text); border-bottom-color: var(--mcp-accent); }

/* Tags / badges ----------------------------------------------------------- */
.mcp-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--mcp-border-strong);
  border-radius: 999px;
  padding: 0 8px;
  font-size: 0.78em;
  color: var(--mcp-muted);
  white-space: nowrap;
}
.mcp-tag[data-tone='ok'] { color: var(--mcp-ok); border-color: color-mix(in srgb, var(--mcp-ok) 45%, var(--mcp-border)); }
.mcp-tag[data-tone='warn'] { color: var(--mcp-warn); border-color: color-mix(in srgb, var(--mcp-warn) 45%, var(--mcp-border)); }
.mcp-tag[data-tone='error'] { color: var(--mcp-error); border-color: color-mix(in srgb, var(--mcp-error) 45%, var(--mcp-border)); }
.mcp-tag[data-tone='info'] { color: var(--mcp-accent); border-color: color-mix(in srgb, var(--mcp-accent) 45%, var(--mcp-border)); }

/* Status ------------------------------------------------------------------ */
.mcp-status { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.mcp-status-glyph { font-size: 0.9em; line-height: 1; }
.mcp-status[data-state='connected'] { color: var(--mcp-ok); }
.mcp-status[data-state='connecting'] { color: var(--mcp-warn); }
.mcp-status[data-state='error'] { color: var(--mcp-error); }
.mcp-status[data-state='disabled'], .mcp-status[data-state='stopped'] { color: var(--mcp-muted); }

/* Cards / rows ------------------------------------------------------------ */
.mcp-card {
  border: 1px solid var(--mcp-border);
  border-radius: var(--mcp-radius);
  background: var(--mcp-raised);
}
.mcp-card-head { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; }
.mcp-card-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.mcp-card-title { font-weight: 600; }
.mcp-card-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.mcp-card-body { padding: 0 14px 12px; }
.mcp-glyph { font-size: 1.35rem; line-height: 1; }
.mcp-list { display: flex; flex-direction: column; gap: 10px; }
.mcp-grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--mcp-gap); }

/* States ------------------------------------------------------------------ */
.mcp-state {
  border: 1px dashed var(--mcp-border-strong);
  border-radius: var(--mcp-radius);
  padding: 18px;
  background: var(--mcp-raised);
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}
.mcp-state[data-tone='error'] { border-color: color-mix(in srgb, var(--mcp-error) 55%, var(--mcp-border)); }
.mcp-state[data-tone='offline'] { border-style: solid; }
.mcp-state-title { font-weight: 600; }
.mcp-state-body { color: var(--mcp-muted); margin: 0; max-width: 68ch; }

/* Form fields ------------------------------------------------------------- */
.mcp-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.mcp-label { font-size: 0.86em; color: var(--mcp-muted); display: flex; gap: 6px; align-items: center; }
.mcp-input, .mcp-select, .mcp-textarea {
  width: 100%;
  background: var(--mcp-sunken);
  border: 1px solid var(--mcp-border-strong);
  border-radius: var(--mcp-radius-sm);
  color: var(--mcp-text);
  padding: 6px 9px;
  font: inherit;
}
.mcp-textarea { min-height: 84px; resize: vertical; font-family: 'Cascadia Mono', ui-monospace, monospace; }
.mcp-input:disabled, .mcp-select:disabled { opacity: 0.6; }
.mcp-hint { font-size: 0.8em; color: var(--mcp-faint); margin: 0; }
.mcp-field-error { color: var(--mcp-error); font-size: 0.84em; margin: 0; }
.mcp-inline-error { color: var(--mcp-error); font-size: 0.85em; }

/* Key/value + arg editors ------------------------------------------------- */
.mcp-kv { display: flex; flex-direction: column; gap: 6px; }
.mcp-kv-row { display: grid; grid-template-columns: minmax(90px, 1fr) minmax(120px, 1.6fr) auto auto; gap: 6px; align-items: center; }
.mcp-arg-row { display: grid; grid-template-columns: minmax(120px, 1fr) auto; gap: 6px; align-items: center; }
.mcp-check { display: inline-flex; align-items: center; gap: 6px; font-size: 0.85em; color: var(--mcp-muted); white-space: nowrap; }

/* Overlay ----------------------------------------------------------------- */
.mcp-overlay {
  position: fixed;
  inset: 0;
  background: rgba(4, 6, 9, 0.6);
  display: flex;
  justify-content: center;
  align-items: stretch;
  padding: 24px;
  z-index: 40;
}
.mcp-sheet {
  background: var(--mcp-bg);
  border: 1px solid var(--mcp-border-strong);
  border-radius: var(--mcp-radius);
  width: min(720px, 100%);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
}
.mcp-sheet[data-wide='true'] { width: min(960px, 100%); }
.mcp-sheet-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--mcp-border);
}
.mcp-sheet-body { overflow: auto; padding: 16px; flex: 1 1 auto; min-height: 0; }
.mcp-sheet-foot {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 12px 16px;
  border-top: 1px solid var(--mcp-border);
  flex-wrap: wrap;
}
.mcp-close { margin-inline-start: auto; }

/* Logs -------------------------------------------------------------------- */
.mcp-logs {
  background: var(--mcp-sunken);
  border: 1px solid var(--mcp-border);
  border-radius: var(--mcp-radius-sm);
  padding: 8px 10px;
  max-height: 340px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mcp-log-line { display: grid; grid-template-columns: 84px 52px 1fr; gap: 8px; align-items: baseline; }
.mcp-log-time { color: var(--mcp-faint); }
.mcp-log-level[data-level='error'] { color: var(--mcp-error); }
.mcp-log-level[data-level='warn'] { color: var(--mcp-warn); }
.mcp-log-level[data-level='info'] { color: var(--mcp-ok); }
.mcp-log-level[data-level='debug'] { color: var(--mcp-faint); }
.mcp-log-message { white-space: pre-wrap; overflow-wrap: anywhere; }

/* Code / patch ------------------------------------------------------------ */
.mcp-code {
  background: var(--mcp-sunken);
  border: 1px solid var(--mcp-border);
  border-radius: var(--mcp-radius-sm);
  padding: 10px;
  margin: 0;
  overflow: auto;
  max-height: 320px;
  white-space: pre;
}
.mcp-kv-list { display: grid; grid-template-columns: minmax(120px, max-content) 1fr; gap: 4px 12px; }
.mcp-kv-list dt { color: var(--mcp-muted); }
.mcp-kv-list dd { margin: 0; overflow-wrap: anywhere; }

/* Runtimes ---------------------------------------------------------------- */
.mcp-runtimes { display: flex; flex-wrap: wrap; gap: 6px; }
.mcp-runtime { display: inline-flex; gap: 6px; align-items: center; }

/* Chips ------------------------------------------------------------------- */
.mcp-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.mcp-chip {
  border: 1px solid var(--mcp-border-strong);
  background: transparent;
  color: var(--mcp-muted);
  border-radius: 999px;
  padding: 2px 10px;
  font: inherit;
  font-size: 0.85em;
  cursor: pointer;
}
.mcp-chip[aria-pressed='true'] { background: var(--mcp-accent-soft); color: var(--mcp-text); border-color: var(--mcp-accent); }

/* Screen-reader only ------------------------------------------------------ */
.mcp-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
`

/**
 * Inject the stylesheet once per document.
 * @param doc - document to install into; defaults to the global one.
 * @returns the style element, or null when there is no document (SSR/tests).
 */
export function ensureStudioStyles(doc: Document | undefined = globalThis.document): HTMLStyleElement | null {
  if (!doc?.head) return null
  const existing = doc.head.querySelector<HTMLStyleElement>(`style[${STYLE_ATTR}]`)
  if (existing) return existing
  const element = doc.createElement('style')
  element.setAttribute(STYLE_ATTR, '')
  element.textContent = STUDIO_CSS
  doc.head.appendChild(element)
  return element
}
