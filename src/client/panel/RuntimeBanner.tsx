/**
 * Runtime availability banner: which local executables exist, and the exact
 * one-line command that installs each missing one.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/RuntimeBanner
 */
import type { RuntimeReport } from '../../shared/contract.js'
import type { LocaleKey, Translate } from '../locales/keys.js'
import type { AsyncView, McpStudioController } from '../state.js'
import { Tag } from './parts/base.js'
import { StateBlock } from './parts/StateBlock.js'

/** Every runtime the host probes, in display order, with its install hint. */
export const RUNTIME_ROWS: Array<{ name: keyof RuntimeReport; hint: LocaleKey }> = [
  { name: 'node', hint: 'runtimeHintNode' },
  { name: 'npx', hint: 'runtimeHintNpx' },
  { name: 'npm', hint: 'runtimeHintNpm' },
  { name: 'pnpm', hint: 'runtimeHintPnpm' },
  { name: 'bunx', hint: 'runtimeHintBunx' },
  { name: 'uvx', hint: 'runtimeHintUvx' },
  { name: 'python', hint: 'runtimeHintPython' },
  { name: 'docker', hint: 'runtimeHintDocker' },
]

/**
 * Render the banner.
 *
 * @param props.view - the controller's runtime view.
 * @param props.controller - used for the retry affordance.
 */
export function RuntimeBanner({
  t,
  view,
  controller,
}: {
  t: Translate
  view: AsyncView<RuntimeReport | null>
  controller: McpStudioController
}) {
  if (view.phase === 'idle' || view.phase === 'loading') {
    return (
      <p className="mcp-hint" role="status" aria-live="polite">
        {t('runtimeTitle')} — {t('loading')}
      </p>
    )
  }
  if (view.phase === 'error') {
    return (
      <StateBlock
        tone="offline"
        title={t('loadFailed')}
        body={view.error ?? t('offlineBody')}
        action={{ label: t('retry'), onClick: () => void controller.loadRuntimes() }}
      />
    )
  }
  const report = view.value
  if (!report) return null

  const missing = RUNTIME_ROWS.filter((row) => report[row.name]?.available !== true)
  if (missing.length === 0) {
    return (
      <p className="mcp-row" role="status">
        <span className="mcp-muted">{t('runtimeTitle')}</span>
        <Tag tone="ok">{t('runtimeAvailable')}</Tag>
        <span className="mcp-hint">{t('runtimeAllGood')}</span>
      </p>
    )
  }

  return (
    <section className="mcp-card" aria-label={t('runtimeTitle')}>
      <div className="mcp-card-head">
        <div className="mcp-card-main">
          <span className="mcp-card-title">
            {t('runtimeMissingTitle', { count: missing.length })}
          </span>
          <span className="mcp-hint">{t('runtimeMissingBody')}</span>
        </div>
      </div>
      <div className="mcp-card-body">
        <ul className="mcp-stack" style={{ gap: 4, margin: 0, paddingInlineStart: 18 }}>
          {missing.map((row) => (
            <li key={row.name}>
              <span className="mcp-mono">{row.name}</span>{' '}
              <Tag tone="warn">{t('runtimeMissing')}</Tag>{' '}
              <span className="mcp-hint">{t(row.hint)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
