/**
 * Sidebar entry glyph: a small inline SVG so the panel has no icon dependency.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/McpStudioIcon
 */
export function McpStudioIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* A plug meeting a socket: "plug a server in". */}
      <path d="M2 11.5h3.2" />
      <path d="M5.2 6.5v8" />
      <path d="M5.2 8.2h3.1a1.6 1.6 0 0 1 1.6 1.6v.4a1.6 1.6 0 0 0 1.6 1.6H14" />
      <path d="M2 4.5h3.2" />
      <path d="M8.6 3.5h2.1" />
      <path d="M9.6 3.5v2" />
      <path d="M11.9 3.5v2" />
      <circle cx="12.8" cy="11.8" r="1.6" />
    </svg>
  )
}
