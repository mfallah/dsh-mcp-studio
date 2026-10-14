/**
 * The page registered into the `main` slot: header, tabs, both tab bodies, and
 * whichever overlay the controller has open.
 *
 * @module @mfallah/dsh-mcp-studio/client/panel/McpStudioPage
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { Translate } from '../locales/keys.js'
import { busyKey, type McpStudioController, type StudioTab } from '../state.js'
import { ensureStudioStyles } from '../styles.js'
import { CatalogTab } from './CatalogTab.js'
import { InstallSheet } from './InstallSheet.js'
import { InstalledTab } from './InstalledTab.js'
import { ManualAddForm } from './ManualAddForm.js'
import { ServerDrawer } from './ServerDrawer.js'
import { RuntimeBanner } from './RuntimeBanner.js'
import { Button } from './parts/base.js'
import { CodeBlock } from './parts/CodeBlock.js'
import { Overlay } from './parts/Overlay.js'
import { StateBlock } from './parts/StateBlock.js'
import { Tabs } from './parts/Tabs.js'

/** The locale service surface this page reads for direction. */
export interface LocaleFace {
  getSnapshot(): { active: string }
  subscribe(listener: () => void): () => void
}

/** Props the slot framework composes for this page. */
export interface StudioPanelProps {
  t: Translate
  controller: McpStudioController
  locale?: LocaleFace | undefined
}

const NO_SUBSCRIBE = () => () => undefined

/** The store shape `useSyncExternalStore` accepts. */
interface DirectionStore {
  subscribe(listener: () => void): () => void
  getSnapshot(): { active: string }
}

/**
 * Resolve writing direction from the active locale; Persian and Arabic are RTL.
 *
 * The store is rebuilt only when `locale` itself changes, and its `subscribe`
 * calls the service as a method rather than forwarding a detached reference.
 * That second part is load-bearing: a locale service whose `subscribe` is a
 * `this`-dependent prototype method throws the moment React calls it bare,
 * which is how the blank-panel regression happened. Rebuilding the store on
 * every render would instead resubscribe on every render, so it is memoised.
 *
 * @param locale - the locale face, or undefined when absent.
 * @returns the direction to render in.
 */
function useDirection(locale: LocaleFace | undefined): 'rtl' | 'ltr' {
  const store = useMemo<DirectionStore | null>(
    () =>
      locale === undefined
        ? null
        : {
            getSnapshot: () => locale.getSnapshot(),
            subscribe: (listener: () => void) => locale.subscribe(listener),
          },
    [locale],
  )
  const active: unknown = useSyncExternalStore(
    store?.subscribe ?? NO_SUBSCRIBE,
    () => store?.getSnapshot().active ?? 'en',
    () => 'en',
  )
  // A service that reports a non-string here must not take the whole app down
  // with a `.startsWith` TypeError.
  return typeof active === 'string' && (active.startsWith('fa') || active.startsWith('ar'))
    ? 'rtl'
    : 'ltr'
}

/**
 * Render the MCP Studio panel.
 *
 * @param props.controller - the single state owner, injected by `apply`.
 * @param props.locale - the locale service, read only for `dir`.
 */
export function McpStudioPanel({ t, controller, locale }: StudioPanelProps) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const dir = useDirection(locale)
  const [patchOpen, setPatchOpen] = useState(false)

  useEffect(() => {
    ensureStudioStyles()
    controller.setVisible(true)
    return () => controller.setVisible(false)
  }, [controller])

  const selectedServer = controller.selectedServer()
  const selectedEntry = controller.selectedCatalogEntry()
  const tab: StudioTab = snapshot.tab

  return (
    <div className="mcp-studio" dir={dir} lang={dir === 'rtl' ? 'fa' : 'en'}>
      <header className="mcp-header">
        <div className="mcp-header-top">
          <div className="mcp-header-titles">
            <h1>{t('title')}</h1>
            <p className="mcp-subtitle">{t('subtitle')}</p>
          </div>
          <div className="mcp-header-actions">
            <Button
              variant="secondary"
              busy={controller.isBusy(busyKey.patch)}
              onClick={() => {
                setPatchOpen(true)
                void controller.exportPatch()
              }}
            >
              {controller.isBusy(busyKey.patch) ? t('exporting') : t('exportPatch')}
            </Button>
            <Button
              variant="secondary"
              busy={controller.isBusy(busyKey.servers) || controller.isBusy(busyKey.catalog)}
              onClick={() => void controller.refresh()}
            >
              {t('refresh')}
            </Button>
          </div>
        </div>
        <Tabs<StudioTab>
          label={t('title')}
          active={tab}
          onChange={(next) => controller.setTab(next)}
          items={[
            { id: 'catalog', label: t('tabCatalog') },
            { id: 'installed', label: t('tabInstalled') },
          ]}
        />
      </header>

      <div className="mcp-body">
        <div className="mcp-stack">
          <RuntimeBanner t={t} view={snapshot.runtimes} controller={controller} />
          {tab === 'catalog' ? (
            <div id="mcp-tabpanel-catalog" role="tabpanel" aria-labelledby="mcp-tab-catalog">
              <CatalogTab t={t} controller={controller} snapshot={snapshot} />
            </div>
          ) : (
            <div id="mcp-tabpanel-installed" role="tabpanel" aria-labelledby="mcp-tab-installed">
              <InstalledTab t={t} controller={controller} snapshot={snapshot} />
            </div>
          )}
        </div>
      </div>

      {snapshot.selection?.kind === 'catalog' && selectedEntry ? (
        <InstallSheet t={t} controller={controller} snapshot={snapshot} entry={selectedEntry} />
      ) : null}

      {snapshot.selection?.kind === 'server' && selectedServer ? (
        <ServerDrawer t={t} controller={controller} snapshot={snapshot} server={selectedServer} />
      ) : null}

      {snapshot.selection?.kind === 'manual' ? (
        <ManualAddForm t={t} controller={controller} snapshot={snapshot} />
      ) : null}

      {patchOpen ? (
        <Overlay
          title={t('patchTitle')}
          subtitle={t('patchSubtitle')}
          closeLabel={t('close')}
          onClose={() => setPatchOpen(false)}
        >
          {snapshot.patch.phase === 'loading' ? (
            <StateBlock tone="loading" title={t('exporting')} body={t('patchSubtitle')} />
          ) : snapshot.patch.phase === 'error' ? (
            <StateBlock
              tone="error"
              title={t('patchError')}
              body={snapshot.patch.error ?? t('offlineBody')}
              action={{ label: t('retry'), onClick: () => void controller.exportPatch() }}
            />
          ) : snapshot.patch.value ? (
            <CodeBlock
              code={snapshot.patch.value}
              copyLabel={t('copy')}
              copiedLabel={t('copied')}
              failedLabel={t('copyFailed')}
            />
          ) : (
            <StateBlock tone="empty" title={t('patchEmpty')} body={t('patchSubtitle')} />
          )}
        </Overlay>
      ) : null}
    </div>
  )
}
