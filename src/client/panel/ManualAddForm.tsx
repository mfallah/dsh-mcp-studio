/**
 * Manual add: configure a stdio or Streamable HTTP server without the catalog.
 *
 * The form owns validation and the secret convention for env/header rows (the
 * client writes those values and puts `${secret:NAME}` in the draft); the
 * catalog path does not come through here, because the host owns its
 * templating.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/ManualAddForm
 */
import { useState } from 'react'
import type { McpTransport, ServerDraft } from '../../shared/contract.js'
import { SERVER_NAME_RE, slugifyServerName } from '../../shared/contract.js'
import type { Translate } from '../locales/keys.js'
import { busyKey, errorKey, type McpStudioController, type StudioSnapshot } from '../state.js'
import { rowsToRecord, sealSecretRows } from './draft.js'
import { Button } from './parts/base.js'
import { ArgListEditor, KeyValueEditor, createKeyValueRow, type KeyValueRow } from './parts/Editors.js'
import { CheckboxField, TextField } from './parts/Field.js'
import { Overlay } from './parts/Overlay.js'

/** @param props.snapshot - the subscribed panel snapshot (install errors). */
export function ManualAddForm({
  t,
  controller,
  snapshot,
}: {
  t: Translate
  controller: McpStudioController
  snapshot: StudioSnapshot
}) {
  const [transport, setTransport] = useState<McpTransport>('stdio')
  const [title, setTitle] = useState('')
  const [serverName, setServerName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [description, setDescription] = useState('')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState<string[]>([''])
  const [cwd, setCwd] = useState('')
  const [url, setUrl] = useState('')
  const [envRows, setEnvRows] = useState<KeyValueRow[]>(() => [createKeyValueRow()])
  const [headerRows, setHeaderRows] = useState<KeyValueRow[]>(() => [createKeyValueRow()])
  const [failOnStartup, setFailOnStartup] = useState(false)
  const [timeoutMs, setTimeoutMs] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const busy = controller.isBusy(busyKey.install)
  const installError = snapshot.actionErrors[errorKey.install]
  const effectiveName = serverName.trim() === '' ? slugifyServerName(title, 'server') : serverName.trim()

  const submit = async () => {
    const trimmedTitle = title.trim()
    if (trimmedTitle === '') {
      setLocalError(t('manualValidateTitle'))
      return
    }
    if (!SERVER_NAME_RE.test(effectiveName)) {
      setLocalError(t('manualValidateName'))
      return
    }
    if (transport === 'stdio' && command.trim() === '') {
      setLocalError(t('manualValidateCommand'))
      return
    }
    if (transport === 'streamable-http' && url.trim() === '') {
      setLocalError(t('manualValidateUrl'))
      return
    }

    const env = rowsToRecord(envRows, effectiveName)
    const headers = rowsToRecord(headerRows, effectiveName)
    const draft: ServerDraft = {
      transport,
      title: trimmedTitle,
      serverName: effectiveName,
      failOnStartupError: failOnStartup,
    }
    if (description.trim() !== '') draft.description = description.trim()
    const parsedTimeout = Number(timeoutMs)
    if (Number.isFinite(parsedTimeout) && parsedTimeout > 0) draft.toolCallTimeoutMs = parsedTimeout

    if (transport === 'stdio') {
      draft.command = command.trim()
      draft.args = args.map((arg) => arg.trim()).filter((arg) => arg !== '')
      draft.env = env.record
      if (cwd.trim() !== '') draft.cwd = cwd.trim()
    } else {
      draft.url = url.trim()
      draft.headers = headers.record
    }

    // Store the raw secret values first — the draft only ever carries their
    // `${secret:name}` references — then seal the rows so no raw value survives
    // in form state, and only then add the server.
    const writes = [...env.secrets, ...headers.secrets]
    if (writes.length > 0) {
      const stored = await controller.persistSecrets(writes)
      if (!stored.ok) {
        setLocalError(stored.error ?? t('installFailed'))
        return
      }
      const names = new Set(writes.map((write) => write.name))
      setEnvRows((rows) => sealSecretRows(rows, effectiveName, names))
      setHeaderRows((rows) => sealSecretRows(rows, effectiveName, names))
    }

    setLocalError(null)
    const result = await controller.install(draft)
    if (!result.ok && result.error) setLocalError(result.error)
  }

  return (
    <Overlay
      title={t('manualTitle')}
      subtitle={t('manualSubtitle')}
      wide
      closeLabel={t('close')}
      onClose={() => controller.closeSelection()}
      footer={
        <Button variant="primary" busy={busy} onClick={() => void submit()}>
          {busy ? t('manualSubmitting') : t('manualSubmit')}
        </Button>
      }
    >
      <div className="mcp-stack">
        <fieldset className="mcp-stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="mcp-card-title">{t('manualSectionTransport')}</legend>
          <div className="mcp-row" role="radiogroup" aria-label={t('manualSectionTransport')}>
            {(['stdio', 'streamable-http'] as McpTransport[]).map((candidate) => (
              <label className="mcp-check" key={candidate}>
                <input
                  type="radio"
                  name="mcp-manual-transport"
                  checked={transport === candidate}
                  onChange={() => setTransport(candidate)}
                />
                {candidate === 'stdio' ? t('manualTransportStdio') : t('manualTransportHttp')}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mcp-stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="mcp-card-title">{t('manualSectionBasics')}</legend>
          <div className="mcp-grid-2">
            <TextField
              label={t('manualTitleField')}
              value={title}
              placeholder={t('manualTitlePlaceholder')}
              onChange={(next) => {
                setTitle(next)
                if (!nameTouched) setServerName(slugifyServerName(next, 'server'))
              }}
            />
            <TextField
              label={t('manualServerName')}
              value={serverName}
              mono
              hint={t('manualServerNameHint', { name: effectiveName })}
              onChange={(next) => {
                setNameTouched(true)
                setServerName(next)
              }}
            />
          </div>
          <TextField
            label={t('manualDescription')}
            value={description}
            placeholder={t('manualDescriptionPlaceholder')}
            onChange={setDescription}
          />
        </fieldset>

        {transport === 'stdio' ? (
          <fieldset className="mcp-stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="mcp-card-title">{t('manualSectionLaunch')}</legend>
            <TextField
              label={t('manualCommand')}
              value={command}
              placeholder={t('manualCommandPlaceholder')}
              mono
              onChange={setCommand}
            />
            <ArgListEditor
              t={t}
              label={t('manualArgs')}
              addLabel={t('manualAddArg')}
              values={args}
              onChange={setArgs}
            />
            <TextField
              label={t('manualCwd')}
              value={cwd}
              placeholder={t('manualCwdPlaceholder')}
              mono
              onChange={setCwd}
            />
            <KeyValueEditor
              t={t}
              label={t('manualEnv')}
              addLabel={t('manualAddEntry')}
              keyPlaceholder={t('manualKeyPlaceholder')}
              valuePlaceholder={t('manualValuePlaceholder')}
              secretLabel={t('manualSecretOn')}
              rows={envRows}
              onChange={setEnvRows}
            />
          </fieldset>
        ) : (
          <fieldset className="mcp-stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="mcp-card-title">{t('manualSectionLaunch')}</legend>
            <TextField
              label={t('manualUrl')}
              value={url}
              placeholder={t('manualUrlPlaceholder')}
              type="url"
              inputMode="url"
              mono
              onChange={setUrl}
            />
            <KeyValueEditor
              t={t}
              label={t('manualHeaders')}
              addLabel={t('manualAddEntry')}
              keyPlaceholder={t('manualKeyPlaceholder')}
              valuePlaceholder={t('manualValuePlaceholder')}
              secretLabel={t('manualSecretOn')}
              rows={headerRows}
              onChange={setHeaderRows}
            />
          </fieldset>
        )}

        <fieldset className="mcp-stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="mcp-card-title">{t('manualSectionAdvanced')}</legend>
          <p className="mcp-hint">{t('manualPlaceholderExpansion')}</p>
          <TextField
            label={t('manualTimeout')}
            value={timeoutMs}
            type="number"
            inputMode="numeric"
            hint={t('manualTimeoutHint')}
            onChange={setTimeoutMs}
          />
          <CheckboxField
            label={t('settingsFailOnStartup')}
            checked={failOnStartup}
            hint={t('settingsFailOnStartupHint')}
            onChange={setFailOnStartup}
          />
        </fieldset>

        {localError ? (
          <p className="mcp-inline-error" role="alert">
            {localError}
          </p>
        ) : null}
        {installError ? (
          <p className="mcp-inline-error" role="alert">
            {t('installFailed')}: {installError}
          </p>
        ) : null}
      </div>
    </Overlay>
  )
}
