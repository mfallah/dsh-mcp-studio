/**
 * blank-panel-matrix.mjs — the acceptance matrix for the MCP Studio white page.
 *
 * Loads the REAL built `lib/client.js`, runs its REAL `apply(ctx)`, composes the
 * `main` props the way the REAL renderer does, and renders the result under
 * jsdom with the repo's own React 18.3.1. Each row is one hypothesis:
 *
 *   A  valid host route (src/host/http.ts envelope)      -> the control
 *   B  missing route: SPA shell answers 200 text/html    -> host not installed
 *   C  host route answers `ok:false`                     -> handler threw
 *   D  locale face with a fresh object per getSnapshot   -> H1
 *   E  locale face whose methods need `this`             -> H2
 *   F  locale.getSnapshot().active is an object          -> H3
 *   G  no `locale` prop at all                           -> H4 (renderer omits it)
 *   H  no `controller` prop                              -> H4 (inject delivered nothing)
 *   I  no `t` prop                                       -> H4 (locale seat missing)
 *
 * RUN: node tests/e2e/blank-panel-matrix.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve as pathResolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = pathResolve(HERE, '..', '..')
const require = createRequire(pathResolve(REPO, 'package.json'))

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

// ---- loader ---------------------------------------------------------------
const registry = new Map()
const moduleCache = new Map()
function loaderRequire(spec) {
  if (moduleCache.has(spec)) return moduleCache.get(spec).exports
  const factory = registry.get(spec)
  if (factory !== undefined) {
    const module = { exports: {} }
    moduleCache.set(spec, module)
    module.exports = factory(loaderRequire)
    return module.exports
  }
  const exports = require(spec)
  moduleCache.set(spec, { exports })
  return exports
}
const ModuleLoader = { load: ({ id, factory }) => registry.set(id, factory), materialize: (id) => loaderRequire(id) }
globalThis.__ModuleLoader__ = ModuleLoader
dom.window.__ModuleLoader__ = ModuleLoader

const ENTRY = '@mfallah/dsh-mcp-studio'
const bundlePath = pathResolve(REPO, 'lib', 'client.js')
const bundleSource = readFileSync(bundlePath, 'utf8')
// eslint-disable-next-line no-new-func
new Function('window', 'globalThis', 'module', 'exports', 'require', `${bundleSource}\nreturn module.exports;`)(dom.window, globalThis, { exports: {} }, {}, loaderRequire)
const mod = loaderRequire(ENTRY)

// ---- failure capture ------------------------------------------------------
const consoleLog = []
console.error = (...a) => consoleLog.push({ level: 'error', text: a.map((x) => (x instanceof Error ? `${x.name}: ${x.message}` : String(x))).join(' ') })
console.warn = (...a) => consoleLog.push({ level: 'warn', text: a.map(String).join(' ') })
const windowErrors = []
dom.window.addEventListener('error', (e) => windowErrors.push({ message: e?.message, stack: e?.error?.stack }))

// ---- shell stand-ins ------------------------------------------------------
const LOCALES_FA = [
  { id: 'en', label: 'English' },
  { id: 'fa', label: 'فارسی', fallback: 'en' },
]

/**
 * STAND-IN for `@deepseek-ai/dsh-client-locale`'s `LocaleRuntime`. Mirrors its
 * real contract (packages/client/locale lib/client.js:1216-1265): a FROZEN
 * snapshot with `active` as a plain string, same reference until a change.
 */
function localeStandIn({ active = 'fa', unstableSnapshot = false, thisBound = false, objectActive = false } = {}) {
  const frozen = Object.freeze({ active: objectActive ? { id: 'fa' } : active, locales: LOCALES_FA, revision: 0 })
  const dicts = new Map()
  const base = {
    register: (ns, values) => {
      dicts.set(ns, values)
      return () => dicts.delete(ns)
    },
    addLanguage: () => () => undefined,
    bind: (ns) => {
      const table = dicts.get(ns) ?? {}
      return (key, params) => {
        const raw = table[active]?.[key] ?? table.en?.[key] ?? key
        if (!params) return raw
        return String(raw).replace(/\{(\w+)\}/g, (_, p) => (p in params ? String(params[p]) : `{${p}}`))
      }
    },
    getSnapshot: () => (unstableSnapshot ? { active, locales: LOCALES_FA, revision: 0 } : frozen),
    subscribe: () => () => undefined,
  }
  if (thisBound) {
    return {
      active,
      locales: LOCALES_FA,
      revision: 0,
      register: base.register,
      addLanguage: base.addLanguage,
      bind: base.bind,
      subscribe() {
        void this.listeners
        return () => undefined
      },
      getSnapshot() {
        return { active: this.active, locales: this.locales, revision: this.revision }
      },
    }
  }
  return base
}

/** STAND-IN for the `slots` host: declaration-aware inject + register. */
function makeCtx(locale) {
  const registrations = []
  return {
    ctx: {
      slots: {
        inject: (name, contribute) => {
          const produced = contribute()
          if (produced && typeof produced.next === 'function') {
            const collected = []
            for (const item of produced) collected.push(item)
            return collected.length === 1 ? collected[0] : collected
          }
          return produced
        },
        register: (options, component) => {
          const handle = { options, component }
          registrations.push(handle)
          return handle
        },
      },
      locale,
      layout: {},
      effect: (callback) => {
        const dispose = callback()
        return () => typeof dispose === 'function' && dispose()
      },
    },
    registrations,
  }
}

// ---- the fake host --------------------------------------------------------
const fetchLog = []
function installFetch(mode) {
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    writable: true,
    value: async (url, init = {}) => {
      let method = '?'
      try {
        method = JSON.parse(init.body)?.method ?? '?'
      } catch {
        /* ignore */
      }
      fetchLog.push(method)
      if (mode === 'missing-route') {
        // A single-page-app fallback: 200 text/html, not JSON.
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'text/html; charset=utf-8' },
          json: async () => {
            throw new SyntaxError("Unexpected token '<', \"<!doctype \"... is not valid JSON")
          },
          text: async () => '<!doctype html><html><body><div id="root"></div></body></html>',
        }
      }
      const value =
        method === 'listServers' || method === 'listSecretNames' || method === 'catalogCategories'
          ? []
          : method === 'detectRuntimes'
            ? { node: true, npx: true, uvx: false, bunx: false }
            : method === 'catalog'
              ? { entries: [], total: 0, registryOnline: true }
              : null
      const body = mode === 'host-error' ? { ok: false, error: { message: 'mcp-studio: host half is not active' } } : { ok: true, value: value === undefined ? null : value }
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => body, text: async () => JSON.stringify(body) }
    },
  })
}

const { act, createElement } = require('react')
const { createRoot } = require('react-dom/client')

// ---- rows -----------------------------------------------------------------
const ROWS = [
  { id: 'A', label: 'valid host route (control)', locale: () => localeStandIn(), fetch: 'ok' },
  { id: 'B', label: 'route missing: SPA answers text/html', locale: () => localeStandIn(), fetch: 'missing-route' },
  { id: 'C', label: 'host route answers ok:false', locale: () => localeStandIn(), fetch: 'host-error' },
  { id: 'D', label: 'H1: fresh object per getSnapshot', locale: () => localeStandIn({ unstableSnapshot: true }), fetch: 'ok' },
  { id: 'E', label: 'H2: locale methods need `this`', locale: () => localeStandIn({ thisBound: true }), fetch: 'ok' },
  { id: 'F', label: 'H3: snapshot.active is an object', locale: () => localeStandIn({ objectActive: true }), fetch: 'ok' },
  { id: 'G', label: 'H4a: no locale prop', locale: () => localeStandIn(), fetch: 'ok', drop: ['locale'] },
  { id: 'H', label: 'H4b: no controller prop', locale: () => localeStandIn(), fetch: 'ok', drop: ['controller'] },
  { id: 'I', label: 'H4c: no t prop', locale: () => localeStandIn(), fetch: 'ok', drop: ['t'] },
]

const results = []
for (const row of ROWS) {
  installFetch(row.fetch)
  fetchLog.length = 0
  consoleLog.length = 0
  windowErrors.length = 0

  const locale = row.locale()
  const { ctx, registrations } = makeCtx(locale)
  let applyError = null
  try {
    mod.apply(ctx)
  } catch (error) {
    applyError = `${error?.stack ?? error}`
  }
  const main = registrations.find((r) => r.options?.name === 'main')
  if (!main && !applyError) {
    results.push({ id: row.id, label: row.label, applyError: 'no main slot registered', render: null })
    continue
  }

  const face = main?.options?.inject ? main.options.inject() : {}
  const props = { t: (key) => key, ...face }
  for (const key of row.drop ?? []) delete props[key]

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  let renderError = null
  const before = windowErrors.length
  try {
    await act(async () => {
      root.render(createElement(main.component, props))
      await new Promise((r) => setTimeout(r, 30))
    })
  } catch (error) {
    renderError = `${error?.stack ?? error}`
  }
  const html = container.innerHTML
  const escaped = windowErrors.slice(before).map((e) => e.message)
  try {
    act(() => root.unmount())
  } catch {
    /* dead already */
  }
  container.remove()
  props.controller?.dispose?.()

  results.push({
    id: row.id,
    label: row.label,
    applyError,
    renderError,
    windowErrors: escaped,
    consoleErrors: consoleLog.filter((c) => c.level === 'error').map((c) => c.text.split('\n')[0]),
    htmlLength: html.length,
    htmlHead: html.slice(0, 160),
    treeEmpty: html.length === 0,
    fetchMethods: [...new Set(fetchLog)],
  })
}

console.log(`${'='.repeat(80)}\nMCP STUDIO BLANK-PANEL MATRIX — ${ENTRY}\n${'='.repeat(80)}`)
for (const r of results) {
  console.log(`\n[${r.id}] ${r.label}`)
  console.log(`    applyError : ${r.applyError ? r.applyError.split('\n')[0] : 'none'}`)
  console.log(`    renderError: ${r.renderError ? r.renderError.split('\n')[0] : 'none'}`)
  console.log(`    windowError: ${r.windowErrors.length ? r.windowErrors.join(' | ') : 'none'}`)
  console.log(`    consoleErr : ${r.consoleErrors.length ? r.consoleErrors.join(' | ') : 'none'}`)
  console.log(`    htmlLength : ${r.htmlLength}${r.treeEmpty ? '  <-- EMPTY TREE' : ''}`)
  console.log(`    htmlHead   : ${r.htmlHead}`)
}
writeFileSync(pathResolve(HERE, 'blank-panel-matrix.out.json'), JSON.stringify(results, null, 2), 'utf8')
