/**
 * Client half entry point for `@mfallah/dsh-mcp-studio`.
 *
 * Registers the Persian and English dictionaries, contributes the sidebar entry
 * and the main panel it opens, and owns the controller that talks to the host
 * route. The registration shape is the DSH client-plugin pattern: `inject`
 * names the services this plugin needs, `apply` contributes slots through
 * `ctx.slots.inject` so registration waits for the slot to be declared.
 *
 * Transport note: the host half is reached over `POST /mcp-studio-api/rpc`
 * (see `rpc.ts`), not through `ctx.remote`, so this plugin does not depend on
 * any host service being reachable over the wire.
 *
 * @module @mfallah/dsh-mcp-studio/client
 */
import { LOCALE_NS, PANEL_ID } from '../shared/contract.js'
import { createStudioFace } from './face.js'
import { en } from './locales/en.js'
import { fa } from './locales/fa.js'
import { McpStudioIcon } from './panel/McpStudioIcon.js'
import { McpStudioPanel } from './panel/McpStudioPage.js'
import { createStudioApi } from './rpc.js'
import { McpStudioController } from './state.js'
import { ensureStudioStyles } from './styles.js'

/** Services this plugin needs before `apply` runs. */
export const inject = ['slots', 'locale', 'layout']

/**
 * Contribute the sidebar entry, the main panel, and the dictionaries.
 *
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: any): void {
  ensureStudioStyles()
  ctx.effect(() => ctx.locale.register(LOCALE_NS, { fa, en }), 'mcp-studio: dictionaries')
  // Persian is a language pack contribution: without it the `fa` dictionary
  // could never be selected, and the panel would silently render English.
  ctx.effect(() => {
    try {
      return ctx.locale.addLanguage({ id: 'fa', label: 'فارسی', fallback: 'en' })
    } catch {
      return () => undefined
    }
  }, 'mcp-studio: persian language')

  const t = ctx.locale.bind(LOCALE_NS)
  const controller = new McpStudioController({ api: createStudioApi() })
  ctx.effect(() => () => controller.dispose(), 'mcp-studio: controller')

  // The locale service goes through `createStudioFace`: its `subscribe` and
  // `getSnapshot` are `this`-dependent prototype methods, and React calls
  // `subscribe` detached. Passing `ctx.locale` directly threw on first render
  // and left the panel blank.
  const face = createStudioFace({ controller, locale: ctx.locale })

  ctx.slots.inject('main', function* () {
    yield ctx.slots.register(
      { name: 'main', key: PANEL_ID, locale: LOCALE_NS, inject: () => face },
      McpStudioPanel,
    )
  })

  ctx.slots.inject('sidebar.panellist', () =>
    ctx.slots.register(
      { name: 'sidebar.panellist', id: PANEL_ID, order: 5, label: () => t('panel'), locale: LOCALE_NS },
      McpStudioIcon,
    ),
  )
}

export { McpStudioController } from './state.js'
export { createStudioApi, createHttpTransport, RPC_PATH, RPC_HEADER, StudioRpcError } from './rpc.js'
