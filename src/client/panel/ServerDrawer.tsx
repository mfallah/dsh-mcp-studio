/**
 * Server drawer: tools, live logs, and settings for one installed server.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/ServerDrawer
 */
import { useEffect, useRef, useState } from 'react'
import type { ServerPatch, ServerView } from '../../shared/contract.js'
import { redactValue } from '../../shared/contract.js'
import type { Translate } from '../locales/keys.js'
import { busyKey, type McpStudioController, type DrawerTab, type StudioSnapshot } from '../state.js'
import { transportLabel } from './draft.js'
import { Button, Tag } from './parts/base.js'
import { CheckboxField, TextAreaField, TextField } from './parts/Field.js'
import { Overlay } from './parts/Overlay.js'
import { StateBlock } from './parts/StateBlock.js'
import { Tabs } from './parts/Tabs.js'
import { STATUS_LABEL } from './InstalledTab.js'

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleTimeString(undefined, { hour12: false })
}

/** @param props.server - the server this drawer is showing. */
export function ServerDrawer({
  t,
  controller,
  snapshot,
  server,
}: {
  t: Translate
  controller: McpStudioController
  snapshot: StudioSnapshot
  server: ServerView
}) {
  const detail = snapshot.detail
  const tab = snapshot.drawerTab
  const config = detail.value?.id === server.id ? detail.value.config : undefined
  const logsRef = useRef<HTMLDivElement | null>(null)
  const [pinned, setPinned] = useState(true)
  const [form, setForm] = useState(() => seedForm(server))
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setForm(seedForm(server))
    setSaved(false)
  }, [server.id, server.updatedAt])

  // Auto-scroll only while the user is already at the bottom.
  useEffect(() => {
    const node = logsRef.current
    if (node && pinned) node.scrollTop = node.scrollHeight
  }, [snapshot.logs, pinned, tab])

  const saveKey = busyKey.server(server.id, 'save')
  const saveError = snapshot.actionErrors[saveKey]

  const save = async () => {
    const timeout = Number(form.toolCallTimeoutMs)
    const patch: ServerPatch = {
      title: form.title.trim() === '' ? server.title : form.title.trim(),
      description: form.description.trim() === '' ? undefined : form.description,
      failOnStartupError: form.failOnStartupError,
    }
    if (Number.isFinite(timeout) && timeout > 0) patch.toolCallTimeoutMs = timeout
    const result = await controller.saveServer(server.id, patch)
    setSaved(result.ok)
  }

  return (
    <Overlay
      wide
      title={server.title}
      subtitle={
        <span className="mcp-row">
          <span className="mcp-mono">mcp__{server.serverName}__*</span>
          <span className="mcp-mono mcp-wrap">{server.target}</span>
          <Tag tone={server.status === 'connected' ? 'ok' : 'neutral'}>{t(STATUS_LABEL[server.status])}</Tag>
        </span>
      }
      closeLabel={t('close')}
      onClose={() => controller.closeSelection()}
    >
      <div className="mcp-stack">
        <Tabs<DrawerTab>
          label={t('title')}
          active={tab}
          onChange={(next) => controller.setDrawerTab(next)}
          items={[
            { id: 'tools', label: t('drawerTools') },
            { id: 'logs', label: t('drawerLogs') },
            { id: 'settings', label: t('drawerSettings') },
          ]}
        />

        {tab === 'tools' ? (
          <div id="mcp-tabpanel-tools" role="tabpanel" aria-labelledby="mcp-tab-tools" className="mcp-stack">
            {detail.phase === 'loading' && detail.value?.id !== server.id ? (
              <StateBlock tone="loading" title={t('toolsLoadingTitle')} body={t('toolsLoadingBody')} />
            ) : null}
            {server.tools.length === 0 ? (
              <StateBlock tone="empty" title={t('toolsEmptyTitle')} body={t('toolsEmptyBody')} />
            ) : (
              <>
                <p className="mcp-hint">
                  {t('toolCount', { count: server.tools.length })} —{' '}
                  {t('toolsNamespaceHint', { namespace: `mcp__${server.serverName}__<tool>` })}
                </p>
                <ul className="mcp-stack" style={{ gap: 4, margin: 0, paddingInlineStart: 18 }}>
                  {server.tools.map((tool) => (
                    <li className="mcp-mono" key={tool}>
                      {tool}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ) : null}

        {tab === 'logs' ? (
          <div id="mcp-tabpanel-logs" role="tabpanel" aria-labelledby="mcp-tab-logs" className="mcp-stack">
            <div className="mcp-row">
              <Button variant="ghost" onClick={() => controller.clearLogs()}>
                {t('logsClear')}
              </Button>
            </div>
            {snapshot.logsError ? <p className="mcp-inline-error">{snapshot.logsError}</p> : null}
            {snapshot.logs.length === 0 ? (
              snapshot.logsPhase === 'error' ? (
                <StateBlock
                  tone="error"
                  title={t('logsErrorTitle')}
                  body={snapshot.logsError ?? t('logsWaitingBody')}
                  action={{ label: t('retry'), onClick: () => void controller.loadLogs(server.id) }}
                />
              ) : snapshot.logsPhase === 'ready' ? (
                <StateBlock tone="empty" title={t('logsEmptyTitle')} body={t('logsEmptyBody')} />
              ) : (
                <StateBlock tone="loading" title={t('logsWaitingTitle')} body={t('logsWaitingBody')} />
              )
            ) : (
              <div
                className="mcp-logs"
                ref={logsRef}
                tabIndex={0}
                role="log"
                aria-live="polite"
                onScroll={() => {
                  const node = logsRef.current
                  if (!node) return
                  setPinned(node.scrollHeight - node.scrollTop - node.clientHeight < 24)
                }}
              >
                {snapshot.logs.map((entry) => (
                  <div className="mcp-log-line" key={entry.seq}>
                    <span className="mcp-log-time">{formatTime(entry.at)}</span>
                    <span className="mcp-log-level" data-level={entry.level}>
                      {entry.level}
                    </span>
                    <span className="mcp-log-message">{entry.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {tab === 'settings' ? (
          <div id="mcp-tabpanel-settings" role="tabpanel" aria-labelledby="mcp-tab-settings" className="mcp-stack">
            <div className="mcp-grid-2">
              <TextField
                label={t('settingsTitleLabel')}
                value={form.title}
                onChange={(next) => setForm({ ...form, title: next })}
              />
              <TextField
                label={t('settingsToolTimeout')}
                value={form.toolCallTimeoutMs}
                type="number"
                inputMode="numeric"
                onChange={(next) => setForm({ ...form, toolCallTimeoutMs: next })}
              />
            </div>
            <TextAreaField
              label={t('settingsDescriptionLabel')}
              rows={2}
              value={form.description}
              onChange={(next) => setForm({ ...form, description: next })}
            />
            <CheckboxField
              label={t('settingsFailOnStartup')}
              checked={form.failOnStartupError}
              hint={t('settingsFailOnStartupHint')}
              onChange={(checked) => setForm({ ...form, failOnStartupError: checked })}
            />
            <div className="mcp-row">
              <Button variant="primary" busy={controller.isBusy(saveKey)} onClick={() => void save()}>
                {controller.isBusy(saveKey) ? t('settingsSaving') : t('settingsEdit')}
              </Button>
              <span className="mcp-hint" role="status" aria-live="polite">
                {saved ? t('saved') : ''}
              </span>
            </div>
            {saveError ? <p className="mcp-inline-error" role="alert">{saveError}</p> : null}

            <h3 className="mcp-card-title">{t('drawerSettings')}</h3>
            {config ? (
              <dl className="mcp-kv-list">
                <dt>{t('settingsTransport')}</dt>
                <dd>{t(transportLabel(config.transport))}</dd>
                <dt>{t('settingsSecretKeys')}</dt>
                <dd>{server.secretKeys.join(', ') || t('none')}</dd>
                {config.transport === 'stdio' ? (
                  <>
                    <dt>{t('settingsCommand')}</dt>
                    <dd className="mcp-mono">{config.command}</dd>
                    <dt>{t('settingsArgs')}</dt>
                    <dd className="mcp-mono">{config.args.join(' ') || t('none')}</dd>
                    <dt>{t('settingsCwd')}</dt>
                    <dd className="mcp-mono">{config.cwd ?? t('none')}</dd>
                    <dt>{t('settingsEnv')}</dt>
                    <dd>
                      <EnvList entries={config.env} />
                    </dd>
                  </>
                ) : (
                  <>
                    <dt>{t('settingsUrl')}</dt>
                    <dd className="mcp-mono">{config.url}</dd>
                    <dt>{t('settingsHeaders')}</dt>
                    <dd>
                      <EnvList entries={config.headers} />
                    </dd>
                  </>
                )}
              </dl>
            ) : (
              <StateBlock tone="loading" title={t('settingsTransport')} body={t('loading')} />
            )}
            <p className="mcp-hint">{t('settingsRedactedHint')}</p>
          </div>
        ) : null}
      </div>
    </Overlay>
  )
}

/** Redacted env/header view: keys always, values only when not secret-like. */
function EnvList({ entries }: { entries: Record<string, string> }) {
  const pairs = Object.entries(entries)
  if (pairs.length === 0) return <>—</>
  return (
    <ul className="mcp-stack" style={{ gap: 2, margin: 0, paddingInlineStart: 16 }}>
      {pairs.map(([key, value]) => (
        <li key={key} className="mcp-mono">
          {key} = {redactValue(key, value)}
        </li>
      ))}
    </ul>
  )
}

function seedForm(server: ServerView) {
  return {
    title: server.title,
    description: server.description ?? '',
    toolCallTimeoutMs: String(server.toolCallTimeoutMs),
    failOnStartupError: server.failOnStartupError,
  }
}
