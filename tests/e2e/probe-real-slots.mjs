/**
 * probe-real-slots.mjs — run the plugin's real `apply(ctx)` against the REAL
 * `SlotCore` from `@deepseek-ai/dsh-client-ui-slots` (its `lib/index.js` is a
 * plain ESM library, so Node can load it directly), and then render the
 * component it registered in the `main` slot through a small host that mirrors
 * the real renderer's composition.
 *
 * This answers: does the plugin's registration shape survive the real slot
 * registry, and does the `main` entry actually reach a render?
 *
 * RUN: node tests/e2e/probe-real-slots.mjs
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve as pathResolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = pathResolve(HERE, '..', '..')
const require = createRequire(pathResolve(REPO, 'package.json'))

// Locate the REAL slots library next to the real client bundles.
const SLOTS_CANDIDATES = [
  'C:/Users/abz19/AppData/Local/npm-cache/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh-client-ui-slots/lib/index.js',
  'C:/Users/abz19/.dsh/profiles/node_modules/@deepseek-ai/dsh-client-ui-slots/lib/index.js',
]
let slotsPath = null
for (const candidate of SLOTS_CANDIDATES) {
  try {
    readFileSync(candidate)
    slotsPath = candidate
    break
  } catch {
    /* keep looking */
  }
}
if (!slotsPath) {
  console.log('REAL SLOTS NOT FOUND — reported as a stand-in substitution')
  process.exit(0)
}
const slots = await import(pathToFileURL(slotsPath).href)
console.log('real slots exports:', Object.keys(slots).join(', '))

const { JSDOM } = require('jsdom')
const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: 'http://127.0.0.1:3080/' })
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true })
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Element = dom.window.Element
globalThis.Node = dom.window.Node
globalThis.MouseEvent = dom.window.MouseEvent
globalThis.Event = dom.window.Event
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const registry = new Map()
const cache = new Map()
function loaderRequire(spec) {
  if (cache.has(spec)) return cache.get(spec).exports
  const factory = registry.get(spec)
  if (factory !== undefined) {
    const module = { exports: {} }
    cache.set(spec, module)
    module.exports = factory(loaderRequire)
    return module.exports
  }
  const exports = require(spec)
  cache.set(spec, { exports })
  return exports
}
globalThis.__ModuleLoader__ = { load: ({ id, factory }) => registry.set(id, factory) }
dom.window.__ModuleLoader__ = globalThis.__ModuleLoader__

const ENTRY = '@mfallah/dsh-mcp-studio'
const source = readFileSync(pathResolve(REPO, 'lib', 'client.js'), 'utf8')
// eslint-disable-next-line no-new-func
new Function('window', 'globalThis', 'module', 'exports', 'require', `${source}\nreturn module.exports;`)(dom.window, globalThis, { exports: {} }, {}, loaderRequire)
const mod = loaderRequire(ENTRY)

// ---- the real slot core ---------------------------------------------------
let core
let coreError = null
try {
  core = new slots.SlotCore()
} catch (error) {
  coreError = `${error?.stack ?? error}`
}
console.log('SlotCore constructed:', core ? 'yes' : `no (${coreError})`)
if (core) {
  console.log('SlotCore methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(core)).join(', '))
}

// ---- the plugin's own ctx -------------------------------------------------
const events = []
const locale = {
  register: () => () => undefined,
  addLanguage: () => () => undefined,
  bind: () => (key) => key,
  getSnapshot: () => Object.freeze({ active: 'fa', locales: [], revision: 0 }),
  subscribe: () => () => undefined,
}

const applied = { error: null }
if (core) {
  // A host shim that exposes only what the real runtime would: slots + locale +
  // layout + effect. `register` goes straight to the real SlotCore.
  const ctx = {
    slots: {
      inject: (name, contribute) => core.inject(name, contribute),
      register: (options, component) => core.register(options, component),
      entries: (name) => core.entries(name),
      subscribe: (...args) => core.subscribe(...args),
    },
    locale,
    layout: {},
    effect: (callback) => {
      const dispose = callback()
      return () => typeof dispose === 'function' && dispose()
    },
  }
  try {
    mod.apply(ctx)
  } catch (error) {
    applied.error = `${error?.stack ?? error}`
  }
  // `SlotCore` is the pure registry: `inject` lives on the runtime Service
  // (absent from this package), but `register` is the same call the runtime
  // forwards. Register the plugin's two shapes exactly as `apply` builds them.
  let directRegister = { main: null, sidebar: null }
  try {
    directRegister.main = core.register(
      { name: 'main', key: 'mcp-studio', locale: 'mcp-studio', inject: () => ({ controller: {}, locale: {} }) },
      function McpStudioPanel() {
        return null
      },
    )
  } catch (error) {
    directRegister.main = `THREW: ${error?.message}`
  }
  try {
    directRegister.sidebar = core.register(
      { name: 'sidebar.panellist', id: 'mcp-studio', order: 5, label: () => 'panel', locale: 'mcp-studio' },
      function McpStudioIcon() {
        return null
      },
    )
  } catch (error) {
    directRegister.sidebar = `THREW: ${error?.message}`
  }
  console.log('direct register(main):', directRegister.main === 'THREW' || String(directRegister.main).startsWith('THREW') ? directRegister.main : 'accepted')
  console.log('direct register(sidebar):', directRegister.sidebar === 'THREW' || String(directRegister.sidebar).startsWith('THREW') ? directRegister.sidebar : 'accepted')
  const mainEntries = core.entries('main')
  const sideEntries = core.entries('sidebar.panellist')
  console.log('apply() error:', applied.error ? applied.error.split('\n')[0] : 'none')
  console.log('real registry entries(main):', mainEntries.length)
  for (const entry of mainEntries) {
    console.log('   main entry options:', JSON.stringify({ name: entry.options?.name, key: entry.options?.key, locale: entry.options?.locale, hasInject: typeof entry.options?.inject }))
  }
  console.log('real registry entries(sidebar.panellist):', sideEntries.length)
  for (const entry of sideEntries) {
    console.log('   sidebar entry options:', JSON.stringify({ name: entry.options?.name, id: entry.options?.id, order: entry.options?.order, locale: entry.options?.locale }))
  }

  // Render the registered main component the way the renderer composes it.
  if (mainEntries.length > 0) {
    const { act, createElement } = require('react')
    const { createRoot } = require('react-dom/client')
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: async (url, init = {}) => {
        const method = JSON.parse(init.body)?.method ?? '?'
        const value =
          method === 'detectRuntimes'
            ? { node: true, npx: true, uvx: false, bunx: false }
            : method === 'catalog'
              ? { entries: [], total: 0, registryOnline: true }
              : []
        const body = { ok: true, value }
        return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }
      },
    })
    const entry = mainEntries[0]
    const props = { t: (key) => key, ...(entry.options.inject ? entry.options.inject() : {}) }
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    let renderError = null
    try {
      await act(async () => {
        root.render(createElement(entry.component, props))
        await new Promise((r) => setTimeout(r, 30))
      })
    } catch (error) {
      renderError = `${error?.stack ?? error}`
    }
    console.log('render error:', renderError ? renderError.split('\n')[0] : 'none')
    console.log('rendered html length:', container.innerHTML.length)
    console.log('rendered head:', container.innerHTML.slice(0, 200))
    try {
      act(() => root.unmount())
    } catch {
      /* ignore */
    }
    props.controller?.dispose?.()
  }
}
