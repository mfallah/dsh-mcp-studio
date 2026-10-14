/**
 * Secrets manager: names only, values go straight to the host and are never
 * read back. Rotate and delete act on one name at a time.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/SecretsSection
 */
import { useState } from 'react'
import type { Translate } from '../locales/keys.js'
import { busyKey, errorKey, type McpStudioController, type StudioSnapshot } from '../state.js'
import { Button } from './parts/base.js'
import { StateBlock } from './parts/StateBlock.js'

const SECRET_NAME_RE = /^[A-Za-z0-9._-]{1,64}$/

/** @param props.snapshot - the subscribed panel snapshot. */
export function SecretsSection({
  t,
  controller,
  snapshot,
}: {
  t: Translate
  controller: McpStudioController
  snapshot: StudioSnapshot
}) {
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [filter, setFilter] = useState('')
  const [rotating, setRotating] = useState<string | null>(null)
  const [rotateValue, setRotateValue] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const secrets = snapshot.secrets
  const busy = controller.isBusy(busyKey.secrets)
  const names = secrets.value.filter((entry) => entry.toLowerCase().includes(filter.trim().toLowerCase()))

  const add = async () => {
    if (!SECRET_NAME_RE.test(name.trim())) {
      setFormError(t('secretsNameInvalid'))
      return
    }
    if (value === '') {
      setFormError(t('secretsValueRequired'))
      return
    }
    setFormError(null)
    const result = await controller.saveSecret(name.trim(), value)
    if (result.ok) {
      setName('')
      setValue('')
    }
  }

  return (
    <section className="mcp-card" aria-label={t('secretsTitle')}>
      <div className="mcp-card-head">
        <div className="mcp-card-main">
          <span className="mcp-card-title">{t('secretsTitle')}</span>
          <span className="mcp-hint">{t('secretsSubtitle')}</span>
        </div>
      </div>
      <div className="mcp-card-body mcp-stack">
        <div className="mcp-row">
          <div className="mcp-grow">
            <label className="mcp-label" htmlFor="mcp-secret-name">
              {t('secretsNamePlaceholder')}
            </label>
            <input
              id="mcp-secret-name"
              className="mcp-input mcp-mono"
              value={name}
              placeholder={t('secretsNamePlaceholder')}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="mcp-grow">
            <label className="mcp-label" htmlFor="mcp-secret-value">
              {t('secretsValuePlaceholder')}
            </label>
            <input
              id="mcp-secret-value"
              className="mcp-input"
              type="password"
              value={value}
              placeholder={t('secretsValuePlaceholder')}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <Button variant="primary" busy={busy} onClick={() => void add()}>
            {t('secretsAdd')}
          </Button>
        </div>
        {formError ? (
          <p className="mcp-inline-error" role="alert">
            {formError}
          </p>
        ) : null}
        {snapshot.actionErrors[errorKey.secrets] ? (
          <p className="mcp-inline-error" role="alert">
            {snapshot.actionErrors[errorKey.secrets]}
          </p>
        ) : null}
        <p className="mcp-hint">{t('secretsStoredNote')}</p>

        {secrets.value.length > 3 ? (
          <div>
            <label className="mcp-label" htmlFor="mcp-secret-filter">
              {t('secretsSearchLabel')}
            </label>
            <input
              id="mcp-secret-filter"
              className="mcp-input"
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </div>
        ) : null}

        {secrets.phase === 'loading' && secrets.value.length === 0 ? (
          <StateBlock tone="loading" title={t('secretsLoadingTitle')} body={t('secretsLoadingBody')} />
        ) : null}
        {secrets.phase === 'error' && secrets.value.length === 0 ? (
          <StateBlock
            tone="error"
            title={t('loadFailed')}
            body={secrets.error ?? t('offlineBody')}
            action={{ label: t('retry'), onClick: () => void controller.loadSecrets() }}
          />
        ) : null}
        {secrets.phase !== 'loading' && secrets.value.length === 0 && secrets.phase !== 'error' ? (
          <StateBlock tone="empty" title={t('secretsEmptyTitle')} body={t('secretsEmptyBody')} />
        ) : null}

        {names.length > 0 ? (
          <ul className="mcp-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {names.map((entry) => (
              <li className="mcp-card" key={entry}>
                <div className="mcp-card-head">
                  <div className="mcp-card-main">
                    <span className="mcp-mono">{entry}</span>
                    {confirming === entry ? <span className="mcp-hint">{t('secretsDeleteConfirm', { name: entry })}</span> : null}
                  </div>
                  <div className="mcp-card-actions">
                    <Button
                      busy={controller.isBusy(busyKey.secret(entry))}
                      onClick={() => {
                        setRotating(rotating === entry ? null : entry)
                        setRotateValue('')
                      }}
                    >
                      {t('secretsRotate')}
                    </Button>
                    <Button variant="danger" onClick={() => setConfirming(confirming === entry ? null : entry)}>
                      {t('secretsDelete')}
                    </Button>
                  </div>
                </div>
                {rotating === entry ? (
                  <div className="mcp-card-body mcp-row">
                    <div className="mcp-grow">
                      <label className="mcp-label" htmlFor={`mcp-rotate-${entry}`}>
                        {t('secretsValuePlaceholder')}
                      </label>
                      <input
                        id={`mcp-rotate-${entry}`}
                        className="mcp-input"
                        type="password"
                        value={rotateValue}
                        onChange={(event) => setRotateValue(event.target.value)}
                      />
                    </div>
                    <Button
                      variant="primary"
                      busy={controller.isBusy(busyKey.secret(entry))}
                      onClick={async () => {
                        const result = await controller.saveSecret(entry, rotateValue)
                        if (result.ok) {
                          setRotating(null)
                          setRotateValue('')
                        }
                      }}
                    >
                      {t('secretsSave')}
                    </Button>
                    <Button variant="ghost" onClick={() => setRotating(null)}>
                      {t('cancel')}
                    </Button>
                  </div>
                ) : null}
                {confirming === entry ? (
                  <div className="mcp-card-body mcp-row">
                    <Button
                      variant="danger"
                      busy={controller.isBusy(busyKey.secret(entry))}
                      onClick={async () => {
                        const result = await controller.removeSecret(entry)
                        if (result.ok) setConfirming(null)
                      }}
                    >
                      {t('confirm')}
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirming(null)}>
                      {t('cancel')}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : secrets.value.length > 0 ? (
          <StateBlock tone="empty" title={t('catalogNoMatchTitle')} body={t('secretsSearchLabel')} />
        ) : null}
      </div>
    </section>
  )
}
