/**
 * probe-ab-this-binding.mjs — the decisive A/B for the blank panel.
 *
 * PRE-FIX `tests/e2e/old-client.js`  (`git show c01a62e:lib/client.js`)
 *   vs
 * CURRENT  `lib/client.js`           (working tree, with src/client/face.ts)
 *
 * `ctx.locale` is a PROTOTYPE-METHOD face — the real `LocaleRuntime` shape taken
 * from `@deepseek-ai/dsh-client-locale/lib/client.js:1194,1260-1265`:
 *
 *     listeners = new Set()
 *     subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) }
 *
 * NOT a closure over its own Set. That distinction is the whole point of this
 * probe: a closure stand-in cannot observe `this` being lost, and therefore
 * cannot reproduce the defect the pre-fix bundle has.
 *
 * Both rows render the component the plugin itself registered through the real
 * `apply(ctx)` — never the component directly, so the `inject: () => face`
 * boundary that actually broke is exercised.
 *
 * RUN: node tests/e2e/probe-ab-this-binding.mjs
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve as pathResolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = pathResolve(HERE, '..', '..')
const require = createRequire(pathResolve(REPO, 'package.json'))
const { JSDOM } = require('jsdom')

const ENTRY = '@mfallah/dsh-mcp-studio'

/** Real `LocaleRuntime` shape: prototype methods that READ `this`. */
class ProtoLocale {
  /** @param {string} active */
  constructor(active) {
    this.active = active
    this.locales = Object.freeze([{ id: 'en', label: 'English' }, { id: 'fa', label: 'فارسی', fallback: 'en' }])
    this.revision = 0
    this.listeners = new Set()
    this.dicts = new Map()
    this.snapshot = Object.freeze({ active: this.active, locales: this.locales, revision: this.revision })
  }
  register(ns, values) {
    this.dicts.set(ns, values)
    return () => this.dicts.delete(ns)
  }
  addLanguage(definition) {
    this.revision += 1
    return () => undefined
  }
  bind(ns) {
    const table = this.dicts.get(ns) ?? {}
    return (key, params) => {
      void this.active
      const raw = table[this.active]?.[key] ?? table.en?.[key] ?? key
      if (!params) return raw
      return String(raw).replace(/\{(\w+)\}/g, (_, p) => (p in params ? String(params[p]) : `{${p}}`))
    }
  }
  getSnapshot() {
    return this.snapshot
  }
  subscribe(fn) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
}

function makeDom() {
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
  return dom
}

/** Fresh module world per row, so the two bundles never share module state. */
function loadBundle(bundlePath, dom) {
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
  const ModuleLoader = { load: ({ id, factory }) => registry.set(id, factory), materialize: (id) => loaderRequire(id) }
  globalThis.__ModuleLoader__ = ModuleLoader
  dom.window.__ModuleLoader__ = ModuleLoader

  const source = readFileSync(bundlePath, 'utf8')
  // eslint-disable-next-line no-new-func
  new Function('window', 'globalThis', 'module', 'exports', 'require', `${source}\nreturn module.exports;`)(dom.window, globalThis, { exports: {} }, {}, loaderRequire)
  if (!registry.has(ENTRY)) throw new Error(`${bundlePath} did not register "${ENTRY}"`)
  return loaderRequire(ENTRY)
}

function installFetch() {
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
      const value =
        method === 'detectRuntimes'
          ? { node: true, npx: true, uvx: false, bunx: false }
          : method === 'catalog'
            ? { entries: [], total: 0, registryOnline: true }
            : []
      const body = { ok: true, value }
      return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => body, text: async () => JSON.stringify(body) }
    },
  })
}

async function run(bundlePath, label) {
  const dom = makeDom()
  installFetch()

  const consoleErrors = []
  const windowErrors = []
  const origError = console.error
  const origWarn = console.warn
  console.error = (...args) => consoleErrors.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(' '))
  console.warn = (...args) => consoleErrors.push(args.map(String).join(' '))
  dom.window.addEventListener('error', (event) => windowErrors.push(event?.error?.stack ?? event?.message ?? String(event)))

  const mod = loadBundle(bundlePath, dom)
  const locale = new ProtoLocale('fa')

  // Real apply(ctx), with the slots host modelled on the real renderer.
  const registrations = []
  let applyError = null
  const ctx = {
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
  }
  try {
    mod.apply(ctx)
  } catch (error) {
    applyError = `${error?.stack ?? error}`
  }

  const main = registrations.find((r) => r.options?.name === 'main')
  const { act, createElement } = require('react')
  const { createRoot } = require('react-dom/client')

  let renderError = null
  let html = ''
  if (main && !applyError) {
    // Props exactly as dsh-client-ui-renderer/lib/client.js:763-769 composes them.
    const props = { t: (key) => key, ...main.options.inject() }
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    try {
      await act(async () => {
        root.render(createElement(main.component, props))
        await new Promise((r) => setTimeout(r, 40))
      })
    } catch (error) {
      renderError = `${error?.stack ?? error}`
    }
    html = container.innerHTML
    try {
      act(() => root.unmount())
    } catch {
      /* already dead */
    }
    props.controller?.dispose?.()
    container.remove()
  } else if (!main) {
    renderError = `apply() registered no main entry; saw ${JSON.stringify(registrations.map((r) => r.options?.name))}`
  }

  console.error = origError
  console.warn = origWarn

  return {
    label,
    bundlePath,
    applyError: applyError ? applyError.split('\n')[0] : null,
    renderError: renderError ? renderError.split('\n')[0] : null,
    renderErrorFull: renderError,
    windowErrors: windowErrors.map((e) => String(e).split('\n')[0]),
    consoleErrors: consoleErrors.map((e) => e.split('\n')[0]),
    htmlLength: html.length,
    htmlHead: html.slice(0, 140),
  }
}

const rows = []
rows.push(await run(pathResolve(HERE, 'old-client.js'), 'PRE-FIX  (git c01a62e:lib/client.js)'))
rows.push(await run(pathResolve(REPO, 'lib', 'client.js'), 'CURRENT  (working tree lib/client.js)'))

console.log(`\n${'='.repeat(78)}\nA/B — prototype-method ctx.locale (real LocaleRuntime shape)\n${'='.repeat(78)}`)
for (const row of rows) {
  console.log(`\n### ${row.label}`)
  console.log(`    bundle      : ${row.bundlePath}`)
  console.log(`    applyError  : ${row.applyError ?? 'none'}`)
  console.log(`    renderError : ${row.renderError ?? 'none'}`)
  console.log(`    windowErrors: ${row.windowErrors.length ? row.windowErrors.join(' | ') : 'none'}`)
  console.log(`    consoleErr  : ${row.consoleErrors.length ? row.consoleErrors.join(' | ') : 'none'}`)
  console.log(`    htmlLength  : ${row.htmlLength}${row.htmlLength === 0 ? '   <-- WHITE PAGE' : ''}`)
  console.log(`    htmlHead    : ${row.htmlHead}`)
}
console.log('\nVERBATIM pre-fix render error:')
console.log(rows[0].renderErrorFull ?? '(none)')
console.log('\nVERBATIM pre-fix window.onerror:')
for (const e of rows[0].windowErrors) console.log(e)
