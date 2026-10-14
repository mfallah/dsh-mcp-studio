/**
 * Install sheet: one field per `CatalogInput`, a connection test, and install.
 *
 * The host owns templating: both buttons ask `installFromCatalog(catalogId,
 * values)` for a draft, then hand that draft to `testConnection` / `addServer`.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/InstallSheet
 */
import { useEffect, useState } from 'react'
import type { CatalogEntry, CatalogInput } from '../../shared/contract.js'
import type { Translate } from '../locales/keys.js'
import { catalogInputsSatisfied, isSecretReference, sealedCatalogValues } from './draft.js'
import {
  errorKey,
  busyKey,
  type CatalogOutcome,
  type McpStudioController,
  type StudioSnapshot,
} from '../state.js'
import { Button, Tag } from './parts/base.js'
import { CheckboxField, TextField } from './parts/Field.js'
import { Overlay } from './parts/Overlay.js'
import { ProbePanel } from './parts/ProbePanel.js'

function initialValues(entry: CatalogEntry): Record<string, string> {
  const values: Record<string, string> = {}
  for (const input of entry.inputs) values[input.key] = input.defaultValue ?? ''
  return values
}

/**
 * Render the install sheet for one catalog entry.
 *
 * @param props.entry - the entry being installed.
 * @param props.snapshot - the subscribed panel snapshot (probe + errors).
 */
export function InstallSheet({
  t,
  controller,
  snapshot,
  entry,
}: {
  t: Translate
  controller: McpStudioController
  snapshot: StudioSnapshot
  entry: CatalogEntry
}) {
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(entry))

  useEffect(() => {
    setValues(initialValues(entry))
  }, [entry.id])

  const satisfied = catalogInputsSatisfied(entry, values)
  const busyProbe = controller.isBusy(busyKey.probe)
  const busyInstall = controller.isBusy(busyKey.install)
  const installError = snapshot.actionErrors[errorKey.install]

  const set = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  /**
   * Once the raw answers are on the host, replace them in form state with their
   * `${secret:key}` references: nothing re-renders the literal value again, and
   * a second Test or the Install still sends the required input.
   */
  const seal = (outcome: CatalogOutcome) => {
    if (outcome.secretsStored) setValues((current) => sealedCatalogValues(entry, current))
  }

  const renderInput = (input: CatalogInput) => {
    const value = values[input.key] ?? ''
    const stored = input.secret === true && isSecretReference(value)
    const label = (
      <span className="mcp-row">
        <span>{input.label}</span>
        <Tag tone={input.required ? 'warn' : 'neutral'}>
          {input.required ? t('installRequiredBadge') : t('installOptionalBadge')}
        </Tag>
        {input.secret ? <Tag tone="info">{stored ? t('installSecretStored') : t('manualSecretOn')}</Tag> : null}
      </span>
    )
    const hint = [
      input.description,
      input.secret ? (stored ? t('installSecretStored') : t('installSecretHint')) : undefined,
    ]
      .filter((part): part is string => typeof part === 'string' && part !== '')
      .join(' ')
    if (input.format === 'boolean') {
      return (
        <CheckboxField
          key={input.key}
          label={label}
          checked={value === 'true'}
          onChange={(checked) => set(input.key, checked ? 'true' : 'false')}
          hint={hint}
        />
      )
    }
    // A stored secret is shown as the reference it now is, not as a password.
    const type = stored ? 'text' : input.format === 'password' || input.secret ? 'password' : input.format === 'number' ? 'number' : 'text'
    return (
      <TextField
        key={input.key}
        label={label}
        value={value}
        onChange={(next) => set(input.key, next)}
        type={type}
        placeholder={input.placeholder}
        hint={hint}
        required={input.required}
        mono={stored || input.format === 'file' || input.format === 'directory'}
        inputMode={input.format === 'number' ? 'numeric' : undefined}
      />
    )
  }

  return (
    <Overlay
      title={t('installTitle', { title: entry.title })}
      subtitle={t('installSubtitle')}
      closeLabel={t('close')}
      onClose={() => controller.closeSelection()}
      footer={
        <>
          <Button
            variant="secondary"
            busy={busyProbe}
            onClick={() => {
              void controller.testCatalogEntry(entry, values).then(seal)
            }}
          >
            {busyProbe ? t('testing') : t('testConnection')}
          </Button>
          <Button
            variant="primary"
            busy={busyInstall}
            disabled={!satisfied}
            label={t('installAction')}
            onClick={() => {
              void controller.installCatalogEntry(entry, values).then(seal)
            }}
          >
            {busyInstall ? t('installing') : t('installAction')}
          </Button>
        </>
      }
    >
      <div className="mcp-stack">
        <div className="mcp-row mcp-hint">
          <Tag tone={entry.source === 'curated' ? 'info' : 'neutral'}>
            {entry.source === 'curated' ? t('catalogSourceCurated') : t('catalogSourceRegistry')}
          </Tag>
          <span>{t('catalogPublisher', { publisher: entry.publisher })}</span>
          {entry.version ? <span>{t('catalogVersion', { version: entry.version })}</span> : null}
        </div>
        <p className="mcp-muted mcp-wrap">{entry.description}</p>

        {entry.inputs.length > 0 ? (
          <div className="mcp-stack">{entry.inputs.map(renderInput)}</div>
        ) : (
          <p className="mcp-hint">{t('catalogNoRequiredInputs')}</p>
        )}

        {!satisfied ? <p className="mcp-hint">{t('manualPlaceholderExpansion')}</p> : null}
        {installError ? (
          <p className="mcp-inline-error" role="alert">
            {t('installFailed')}: {installError}
          </p>
        ) : null}

        <ProbePanel t={t} view={snapshot.probe} />
      </div>
    </Overlay>
  )
}
