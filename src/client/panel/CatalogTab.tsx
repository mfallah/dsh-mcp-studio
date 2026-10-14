/**
 * Catalog tab: search, source filter, category chips, and one row per entry.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/CatalogTab
 */
import { useEffect, useRef, useState } from 'react'
import type { CatalogSource } from '../../shared/contract.js'
import type { Translate } from '../locales/keys.js'
import { busyKey, type McpStudioController, type StudioSnapshot } from '../state.js'
import { transportLabel } from './draft.js'
import { Button, Chip, Tag } from './parts/base.js'
import { StateBlock } from './parts/StateBlock.js'

const SOURCES: Array<CatalogSource | 'all'> = ['all', 'curated', 'registry']

/**
 * Render the catalog.
 *
 * @param props.snapshot - the subscribed panel snapshot.
 * @param props.controller - actions (query changes, opening the install sheet).
 */
export function CatalogTab({
  t,
  controller,
  snapshot,
}: {
  t: Translate
  controller: McpStudioController
  snapshot: StudioSnapshot
}) {
  const { catalog, catalogQuery, categories } = snapshot
  const [text, setText] = useState(catalogQuery.text ?? '')
  const applied = useRef(catalogQuery.text ?? '')

  // Debounce typing: the host is asked once the user pauses, not per keystroke.
  useEffect(() => {
    if (text === applied.current) return
    const handle = setTimeout(() => {
      applied.current = text
      controller.setCatalogQuery({ text })
    }, 250)
    return () => clearTimeout(handle)
  }, [text, controller])

  const source: CatalogSource | 'all' = catalogQuery.source ?? 'all'
  const activeCategory = catalogQuery.category ?? ''
  const filtering = text.trim() !== '' || activeCategory !== ''
  const busy = controller.isBusy(busyKey.catalog)

  return (
    <div className="mcp-stack">
      <div className="mcp-row">
        <div className="mcp-grow">
          <label className="mcp-label" htmlFor="mcp-catalog-search">
            {t('catalogSearchLabel')}
          </label>
          <input
            id="mcp-catalog-search"
            className="mcp-input"
            type="search"
            value={text}
            placeholder={t('catalogSearchPlaceholder')}
            onChange={(event) => setText(event.target.value)}
          />
        </div>
        <div>
          <label className="mcp-label" htmlFor="mcp-catalog-source">
            {t('catalogAllSources')}
          </label>
          <select
            id="mcp-catalog-source"
            className="mcp-select"
            value={source}
            onChange={(event) =>
              controller.setCatalogQuery({
                source: event.target.value === 'all' ? undefined : (event.target.value as CatalogSource),
              })
            }
          >
            {SOURCES.map((value) => (
              <option key={value} value={value}>
                {value === 'all'
                  ? t('catalogAllSources')
                  : value === 'curated'
                    ? t('catalogSourceCurated')
                    : t('catalogSourceRegistry')}
              </option>
            ))}
          </select>
        </div>
        <Button variant="secondary" busy={busy} onClick={() => void controller.loadCatalog()}>
          {busy ? t('refreshing') : t('refresh')}
        </Button>
      </div>

      {categories.length > 0 ? (
        <div className="mcp-chips" role="group" aria-label={t('catalogCategoryLabel')}>
          <Chip pressed={activeCategory === ''} onClick={() => controller.setCatalogQuery({ category: undefined })}>
            {t('catalogAllCategories')}
          </Chip>
          {categories.map((category) => (
            <Chip
              key={category}
              pressed={activeCategory === category}
              onClick={() => controller.setCatalogQuery({ category })}
            >
              {category}
            </Chip>
          ))}
        </div>
      ) : null}

      {!catalog.registryOnline ? (
        <p className="mcp-row mcp-hint" role="status">
          <Tag tone="warn">{t('catalogSourceCurated')}</Tag>
          <span>{catalog.registryError ?? t('catalogOfflineBadge')}</span>
        </p>
      ) : null}

      {catalog.stale ? <p className="mcp-inline-error">{catalog.error}</p> : null}

      {renderList()}
    </div>
  )

  function renderList() {
    if (catalog.phase === 'loading' && catalog.value.length === 0) {
      return <StateBlock tone="loading" title={t('catalogLoadingTitle')} body={t('catalogLoadingBody')} />
    }
    if (catalog.phase === 'error' && catalog.value.length === 0) {
      return (
        <StateBlock
          tone="error"
          title={t('catalogErrorTitle')}
          body={catalog.error ?? t('offlineBody')}
          action={{ label: t('retry'), onClick: () => void controller.loadCatalog() }}
        />
      )
    }
    if (catalog.value.length === 0) {
      return filtering ? (
        <StateBlock tone="empty" title={t('catalogNoMatchTitle')} body={t('catalogNoMatchBody')} />
      ) : (
        <StateBlock tone="empty" title={t('catalogEmptyTitle')} body={t('catalogEmptyBody')} />
      )
    }

    return (
      <>
        <p className="mcp-hint">
          {t('catalogCount', { shown: catalog.value.length, total: catalog.total })}
        </p>
        <ul className="mcp-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {catalog.value.map((entry) => {
            const required = entry.inputs.filter((input) => input.required).length
            return (
              <li className="mcp-card" key={entry.id}>
                <div className="mcp-card-head">
                  <span className="mcp-glyph" aria-hidden="true">
                    {entry.glyph ?? '◆'}
                  </span>
                  <div className="mcp-card-main">
                    <span className="mcp-card-title">{entry.title}</span>
                    <span className="mcp-row mcp-hint">
                      <span>{t('catalogPublisher', { publisher: entry.publisher })}</span>
                      {entry.version ? <span>{t('catalogVersion', { version: entry.version })}</span> : null}
                      <Tag tone={entry.source === 'curated' ? 'info' : 'neutral'}>
                        {entry.source === 'curated' ? t('catalogSourceCurated') : t('catalogSourceRegistry')}
                      </Tag>
                      <Tag tone="neutral">{t(transportLabel(entry.transport))}</Tag>
                      {entry.offline ? <Tag tone="neutral">{t('catalogOfflineBadge')}</Tag> : null}
                      <span>
                        {required > 0
                          ? t('catalogRequiredInputs', { count: required })
                          : t('catalogNoRequiredInputs')}
                      </span>
                    </span>
                    <span className="mcp-muted mcp-wrap">{entry.description}</span>
                  </div>
                  <div className="mcp-card-actions">
                    <Button
                      variant="primary"
                      label={t('installTitle', { title: entry.title })}
                      onClick={() => controller.selectCatalogEntry(entry.id)}
                    >
                      {t('installAction')}
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </>
    )
  }
}
