/**
 * Installed tab: live rows, per-row actions with an inline confirm, and the
 * secrets manager underneath.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/InstalledTab
 */
import { useState } from 'react'
import type { ServerStatus } from '../../shared/contract.js'
import type { LocaleKey, Translate } from '../locales/keys.js'
import { busyKey, type McpStudioController, type StudioSnapshot } from '../state.js'
import { Button, StatusDot, Tag } from './parts/base.js'
import { StateBlock } from './parts/StateBlock.js'
import { SecretsSection } from './SecretsSection.js'

/** Translated label for each lifecycle state. */
export const STATUS_LABEL: Record<ServerStatus, LocaleKey> = {
  connected: 'statusConnected',
  connecting: 'statusConnecting',
  error: 'statusError',
  disabled: 'statusDisabled',
  stopped: 'statusStopped',
}

/** @param props.snapshot - the subscribed panel snapshot. */
export function InstalledTab({
  t,
  controller,
  snapshot,
}: {
  t: Translate
  controller: McpStudioController
  snapshot: StudioSnapshot
}) {
  const [confirming, setConfirming] = useState<string | null>(null)
  const { servers } = snapshot
  const refreshing = controller.isBusy(busyKey.servers)

  return (
    <div className="mcp-stack">
      <div className="mcp-row">
        <span className="mcp-grow" />
        <Button variant="primary" onClick={() => controller.selectManual()}>
          {t('installedAddManual')}
        </Button>
        <Button variant="secondary" busy={refreshing} onClick={() => void controller.loadServers()}>
          {refreshing ? t('refreshing') : t('refresh')}
        </Button>
      </div>

      {servers.stale ? <p className="mcp-inline-error">{t('installedOfflineNote')}</p> : null}

      {servers.phase === 'loading' && servers.value.length === 0 ? (
        <StateBlock tone="loading" title={t('installedLoadingTitle')} body={t('installedLoadingBody')} />
      ) : null}

      {servers.phase === 'error' && servers.value.length === 0 ? (
        <StateBlock
          tone="error"
          title={t('installedErrorTitle')}
          body={servers.error ?? t('offlineBody')}
          action={{ label: t('retry'), onClick: () => void controller.loadServers() }}
        />
      ) : null}

      {servers.phase !== 'loading' || servers.value.length > 0 ? (
        servers.value.length === 0 && servers.phase !== 'error' ? (
          <StateBlock
            tone="empty"
            title={t('installedEmptyTitle')}
            body={t('installedEmptyBody')}
            action={{ label: t('installedAddManual'), onClick: () => controller.selectManual() }}
          />
        ) : (
          <ul className="mcp-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {servers.value.map((server) => {
              const toggleKey = busyKey.server(server.id, 'toggle')
              const restartKey = busyKey.server(server.id, 'restart')
              const removeKey = busyKey.server(server.id, 'remove')
              const rowError =
                snapshot.actionErrors[toggleKey] ??
                snapshot.actionErrors[restartKey] ??
                snapshot.actionErrors[removeKey]
              return (
                <li className="mcp-card" key={server.id}>
                  <div className="mcp-card-head">
                    <div className="mcp-card-main">
                      <span className="mcp-row">
                        <StatusDot status={server.status} label={t(STATUS_LABEL[server.status])} />
                        <span className="mcp-card-title">{server.title}</span>
                        {server.usesSecrets ? <Tag tone="info">{t('settingsUsesSecrets')}</Tag> : null}
                      </span>
                      <span className="mcp-row mcp-hint">
                        <span className="mcp-mono" title={t('namespaceLabel')}>
                          mcp__{server.serverName}__*
                        </span>
                        <span className="mcp-mono mcp-wrap">{server.target}</span>
                        <span>
                          {server.toolCount > 0
                            ? t('toolCount', { count: server.toolCount })
                            : t('toolCountNone')}
                        </span>
                      </span>
                      {server.lastError ? (
                        <span className="mcp-inline-error mcp-wrap">
                          {t('lastErrorLabel')}: {server.lastError}
                        </span>
                      ) : null}
                      {rowError ? (
                        <p className="mcp-inline-error" role="alert">
                          {rowError}
                        </p>
                      ) : null}
                    </div>
                    <div className="mcp-card-actions">
                      <Button
                        busy={controller.isBusy(toggleKey)}
                        onClick={() => void controller.toggleServer(server.id, !server.enabled)}
                      >
                        {server.enabled ? t('actionDisable') : t('actionEnable')}
                      </Button>
                      <Button
                        busy={controller.isBusy(restartKey)}
                        onClick={() => void controller.restartServer(server.id)}
                      >
                        {t('actionRestart')}
                      </Button>
                      <Button
                        onClick={() => {
                          controller.selectServer(server.id)
                          controller.setDrawerTab('settings')
                        }}
                      >
                        {t('actionEdit')}
                      </Button>
                      <Button variant="danger" onClick={() => setConfirming(server.id)}>
                        {t('actionDelete')}
                      </Button>
                    </div>
                  </div>
                  {confirming === server.id ? (
                    <div className="mcp-card-body">
                      <p>{t('deleteConfirmTitle', { title: server.title })}</p>
                      <p className="mcp-hint">{t('deleteConfirmBody')}</p>
                      <div className="mcp-row">
                        <Button
                          variant="danger"
                          busy={controller.isBusy(removeKey)}
                          onClick={async () => {
                            const result = await controller.removeServer(server.id)
                            if (result.ok) setConfirming(null)
                          }}
                        >
                          {t('deleteConfirmAction')}
                        </Button>
                        <Button variant="ghost" onClick={() => setConfirming(null)}>
                          {t('cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )
      ) : null}

      <SecretsSection t={t} controller={controller} snapshot={snapshot} />
    </div>
  )
}
