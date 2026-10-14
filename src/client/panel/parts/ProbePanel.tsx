/**
 * Probe result rendering: ok, failure code, duration, and the discovered tools.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/parts/ProbePanel
 */
import type { ProbeResult } from '../../../shared/contract.js'
import type { LocaleKey, Translate } from '../../locales/keys.js'
import type { AsyncView } from '../../state.js'
import { Tag } from './base.js'
import { StateBlock } from './StateBlock.js'

const CODE_COPY: Record<NonNullable<ProbeResult['code']>, LocaleKey> = {
  'spawn-failed': 'probeCodeSpawnFailed',
  'command-missing': 'probeCodeCommandMissing',
  'http-error': 'probeCodeHttpError',
  'handshake-failed': 'probeCodeHandshakeFailed',
  timeout: 'probeCodeTimeout',
  'invalid-config': 'probeCodeInvalidConfig',
  'namespace-in-use': 'probeCodeNamespaceInUse',
}

/** How many tool names to spell out before switching to a count. */
const TOOL_PREVIEW = 12

/**
 * Render the last connection test.
 *
 * @param props.view - the controller's probe view.
 */
export function ProbePanel({ t, view }: { t: Translate; view: AsyncView<ProbeResult | null> }) {
  if (view.phase === 'idle') {
    return <StateBlock tone="empty" title={t('probeIdleTitle')} body={t('probeIdleBody')} />
  }
  if (view.phase === 'loading') {
    return <StateBlock tone="loading" title={t('testing')} body={t('probeIdleBody')} />
  }
  if (view.phase === 'error' || !view.value) {
    return (
      <StateBlock
        tone="error"
        title={t('probeFailed')}
        body={view.error ?? t('probeCodeInvalidConfig')}
      />
    )
  }

  const result = view.value
  const tools = result.tools ?? []
  return (
    <div className="mcp-card">
      <div className="mcp-card-head">
        <div className="mcp-card-main">
          <span className="mcp-row">
            <Tag tone={result.ok ? 'ok' : 'error'}>{result.ok ? t('probeOk') : t('probeFailed')}</Tag>
            <span className="mcp-hint">{t('probeDuration', { ms: result.durationMs })}</span>
            {result.protocolVersion ? (
              <span className="mcp-hint">{t('probeProtocol', { version: result.protocolVersion })}</span>
            ) : null}
          </span>
          {result.serverInfo ? (
            <span className="mcp-hint mcp-wrap">
              {t('probeServerInfo', { name: result.serverInfo.name, version: result.serverInfo.version })}
            </span>
          ) : null}
        </div>
      </div>
      <div className="mcp-card-body mcp-stack" style={{ gap: 6 }}>
        {result.ok ? (
          <>
            <span>{tools.length > 0 ? t('probeToolsFound', { count: tools.length }) : t('probeNoTools')}</span>
            {tools.length > 0 ? (
              <p className="mcp-hint mcp-wrap mcp-mono">{tools.slice(0, TOOL_PREVIEW).join(', ')}</p>
            ) : null}
          </>
        ) : (
          <>
            <p className="mcp-wrap">{result.error ?? t('probeCodeInvalidConfig')}</p>
            {result.code ? <p className="mcp-hint">{t(CODE_COPY[result.code])}</p> : null}
          </>
        )}
      </div>
    </div>
  )
}
