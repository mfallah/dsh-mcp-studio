/**
 * blank-panel-repro.mjs — reproduce the MCP Studio white-page crash.
 *
 * Runs the REAL built bundle `lib/client.js` of `@mfallah/dsh-mcp-studio` inside
 * jsdom, behind a real lazy-CJS `window.__ModuleLoader__`, with the REAL React /
 * react-dom from this repo and a faithful stand-in for the two shell services
 * the bundle touches (`ctx.locale`, `ctx.slots`).
 *
 * RUN:  node tests/e2e/blank-panel-repro.mjs        (from F:\harness\dsh-mcp-studio)
 *
 * Why `require` is shared with Node instead of hand-faking React: React's own
 * module cache must be the one `react-dom` sees, otherwise React sees two
 * different `react` copies and every hook throws a dispatcher error that would
 * mask the real bug. Native specifiers therefore go through Node's `require`
 * (memoized, so `react`, `react-dom` and `react/jsx-runtime` are one instance).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve as pathResolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = pathResolve(HERE, '..', '..')
const require = createRequire(pathResolve(REPO, 'package.json'))

// ---------------------------------------------------------------- jsdom ------
const { JSDOM } = require('jsdom')
const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true,
  url: 'http://127.0.0.1:3080/',
})

globalThis.window = dom.window
globalThis.document = dom.window.document
// Node >= 21 defines a getter-only `globalThis.navigator`; redefine it.
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
})
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.Element = dom.window.Element
globalThis.Node = dom.window.Node
globalThis.MouseEvent = dom.window.MouseEvent
globalThis.KeyboardEvent = dom.window.KeyboardEvent
globalThis.Event = dom.window.Event
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame?.bind(dom.window) ?? ((cb) => setTimeout(() => cb(Date.now()), 0))
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame?.bind(dom.window) ?? clearTimeout
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// Window-level crash capture, exactly as a browser would report it.
const windowErrors = []
dom.window.addEventListener('error', (event) => {
  windowErrors.push({ type: 'window.error', message: event?.message ?? String(event?.error ?? event), error: event?.error })
})
dom.window.onerror = (message, source, lineno, colno, error) => {
  windowErrors.push({ type: 'window.onerror', message, source, lineno, colno, error })
  return false
}

// ------------------------------------------------------------- loader --------
/** The real DSH client envelope: `window.__ModuleLoader__.load({id, factory})`. */
const registry = new Map()
const moduleCache = new Map()

function nodeRequire(spec) {
  return require(spec)
}

function loaderRequire(spec) {
  if (moduleCache.has(spec)) return moduleCache.get(spec).exports
  const entry = registry.get(spec)
  if (entry !== undefined) {
    const module = { exports: {} }
    moduleCache.set(spec, module)
    try {
      module.exports = entry(loaderRequire)
    } catch (error) {
      moduleCache.delete(spec)
      throw error
    }
    return module.exports
  }
  // Not a client package: the shell's platform table falls back to the shipped
  // modules. In Node that is the repo's own node_modules (single React copy).
  const exports = nodeRequire(spec)
  moduleCache.set(spec, { exports })
  return exports
}

const ModuleLoader = {
  load({ id, factory }) {
    if (registry.has(id)) throw new Error(`duplicate module id: ${id}`)
    registry.set(id, factory)
  },
  has: (id) => registry.has(id),
  materialize: (id) => {
    if (!registry.has(id) && !moduleCache.has(id)) {
      // let a native package through unchanged
      return nodeRequire(id)
    }
    return loaderRequire(id)
  },
  ids: () => [...registry.keys()],
}

globalThis.__ModuleLoader__ = ModuleLoader
dom.window.__ModuleLoader__ = ModuleLoader

function loadClientBundle(pkgName, file) {
  const source = readFileSync(file, 'utf8')
  const previous = globalThis.window.__ModuleLoader__
  const self = { exports: {} }
  // Append an inline source map built from lib/index.js.map, whose `sources`
  // match lib/client.js, so `node --enable-source-maps` reports original
  // src/... line numbers instead of shifted eval line numbers.
  let inlineMap = ''
  try {
    const raw = JSON.parse(readFileSync(pathResolve(REPO, 'lib', 'index.js.map'), 'utf8'))
    const forClient = { ...raw, file: 'client.js' }
    inlineMap = `\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(JSON.stringify(forClient)).toString('base64')}`
  } catch {
    /* no map: raw eval line numbers are still reported */
  }
  // eslint-disable-next-line no-new-func
  const run = new Function('window', 'globalThis', 'module', 'exports', 'require', `${source}\nreturn module.exports;\n//# sourceURL=${file}${inlineMap}`)
  run(dom.window, globalThis, self, self.exports, loaderRequire)
  globalThis.window.__ModuleLoader__ = previous ?? ModuleLoader
  if (!registry.has(pkgName)) throw new Error(`bundle at ${file} did not register id "${pkgName}"`)
}

// ------------------------------------------------------------- report --------
const report = { console: [], steps: [], errors: [], uncaught: [], unhandled: [], fetchTimes: [], html: '', panels: {} }

function recordConsole(level, args) {
  const text = args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack}`
      if (typeof a === 'string') return a
      try {
        return JSON.stringify(a)
      } catch {
        return String(a)
      }
    })
    .join(' ')
  report.console.push({ level, text })
}

const realConsole = { log: console.log, warn: console.warn, error: console.error }

function writeReport() {
  try {
    writeFileSync(pathResolve(REPO, 'tests', 'e2e', 'blank-panel-repro.out.json'), JSON.stringify(report, null, 2), 'utf8')
  } catch {
    /* best effort */
  }
}

// React re-throws an uncaught render error asynchronously (reportError). Without
// these, Node kills the process before a report is written.
process.on('uncaughtException', (error) => {
  report.uncaught.push(`${error?.stack ?? error}`)
  writeReport()
})
process.on('unhandledRejection', (error) => {
  report.unhandled.push(`${error?.stack ?? error}`)
})
console.warn = (...args) => recordConsole('warn', args)
console.error = (...args) => recordConsole('error', args)

function step(name, fn) {
  try {
    const value = fn()
    report.steps.push({ step: name, ok: true })
    return value
  } catch (error) {
    report.steps.push({ step: name, ok: false, error: `${error?.stack ?? error}` })
    throw error
  }
}

// ------------------------------------------------------- load bundle ---------
const ENTRY_ID = '@mfallah/dsh-mcp-studio'
loadClientBundle(ENTRY_ID, pathResolve(REPO, 'lib', 'client.js'))
const mod = loaderRequire(ENTRY_ID)
report.steps.push({ step: 'bundle materialized', ok: true, exports: Object.keys(mod) })

// ------------------------------------------- faithful shell stand-ins --------
/**
 * STAND-IN, not the real service: `ctx.locale`.
 *
 * Faithful to `@deepseek-ai/dsh-client-locale`'s `LocaleRuntime` on the points
 * this plugin touches (lib/client.js:1216-1265): `getSnapshot()` returns a
 * FROZEN object with `active` (a string), `locales`, `revision`, and the SAME
 * reference until the next change; `subscribe`/`bind`/`register`/`addLanguage`
 * are the real surface. The real class needs a mounted cordis Context and a
 * settings scope; the shape here is what its own docs promise.
 */
function createLocaleStandIn(active = 'fa') {
  const snapshot = Object.freeze({ active, locales: Object.freeze([{ id: 'en', label: 'English' }, { id: 'fa', label: 'فارسی', fallback: 'en' }]), revision: 0 })
  let current = { active, locales: snapshot.locales, revision: 0 }
  const listeners = new Set()
  const dicts = new Map()
  return {
    kind: 'stand-in',
    register(ns, values) {
      dicts.set(ns, values)
      return () => dicts.delete(ns)
    },
    addLanguage(definition) {
      return () => undefined
    },
    bind(ns) {
      const table = dicts.get(ns) ?? {}
      return (key, params) => {
        const raw = table[active]?.[key] ?? table.en?.[key] ?? key
        if (!params) return raw
        return String(raw).replace(/\{(\w+)\}/g, (_, p) => (p in params ? String(params[p]) : `{${p}}`))
      }
    },
    getSnapshot() {
      return current
    },
    subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    setActive(next) {
      current = Object.freeze({ active: next, locales: snapshot.locales, revision: current.revision + 1 })
      for (const fn of [...listeners]) fn()
    },
  }
}

/** Minimal slots core: declaration-aware `inject` + `register` + the main/sidebar bookkeeping. */
function createSlotsStandIn() {
  const registrations = []
  const declarations = new Map()
  return {
    kind: 'stand-in',
    registrations,
    declare(name) {
      const set = declarations.get(name) ?? new Set()
      declarations.set(name, set)
      return set
    },
    inject(name, contribute) {
      // Real SlotsCore side: `inject` names a declaration this entry feeds.
      const set = this.declare(name)
      const value = contribute()
      // A generator contribution (the `main` slot's shape) is drained like the real API.
      if (value && typeof value[Symbol.iterator] === 'function' && typeof value.next === 'function') {
        for (const produced of value) set.add(produced)
      } else {
        set.add(value)
      }
      return value
    },
    register(options, component) {
      const handle = { options, component, dispose: () => undefined }
      registrations.push(handle)
      return handle
    },
  }
}

function createLayoutStandIn() {
  return {
    kind: 'stand-in',
    setMainPanel: () => () => undefined,
    openPanel: () => undefined,
  }
}

function makeContext({ locale }) {
  const effects = []
  const slots = createSlotsStandIn()
  const ctx = {
    slots,
    locale,
    layout: createLayoutStandIn(),
    effect(callback, name) {
      const dispose = callback()
      effects.push({ name, dispose })
      return () => {
        if (typeof dispose === 'function') dispose()
      }
    },
    __effects: effects,
  }
  return ctx
}

// ------------------------------------------------------------- render --------
const { act, createElement } = require('react')
const { createRoot } = require('react-dom/client')

async function flush(times = 4) {
  for (let i = 0; i < times; i += 1) await new Promise((r) => setTimeout(r, 0))
}

/**
 * Props exactly as `dsh-client-ui-renderer` composes them
 * (lib/client.js:763-769): `{ ...kit, ...injected, ...slotInjected.props, ...ownerProps }`.
 * `kit` carries the locale `t` seat (renderer lib/client.js:715-725) plus the
 * standard props; `injected` is this plugin's `inject: () => face` result
 * (controller + locale). Slot-level and owner props are empty for `main`.
 */
function composeMainProps(entry, locale) {
  const kit = {
    t: (key, params) => locale.bind('mcp-studio')(key, params),
  }
  const injected = entry.options.inject ? entry.options.inject() : {}
  return { ...kit, ...injected }
}

async function mountAndRender({ label, localeFactory, extraProps = {} }) {
  const locale = localeFactory()
  const ctx = makeContext({ locale })
  try {
    mod.apply(ctx)
  } catch (error) {
    report.panels[label] = { label, props: [], error: `apply() threw: ${error?.stack ?? error}`, html: '', htmlLength: 0, applyThrew: true }
    return report.panels[label]
  }

  const mainReg = ctx.slots.registrations.find((r) => r.options?.name === 'main')
  if (!mainReg) throw new Error(`apply() registered no 'main' slot entry; got ${JSON.stringify(ctx.slots.registrations.map((r) => r.options?.name))}`)

  const props = { ...composeMainProps(mainReg, locale), ...extraProps }
  const Comp = mainReg.component

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const outcome = { label, props: Object.keys(props), error: null, html: '', unmounted: false, fetchCalls: [], probe: null }

  // Look at exactly what the component receives before it renders: a missing
  // collection here is a real composition bug, not a harness artifact.
  try {
    const snap = props.controller.getSnapshot()
    outcome.probe = {
      snapshotKeys: Object.keys(snap),
      hasCategories: 'categories' in snap,
      categoriesType: Array.isArray(snap.categories) ? `array(${snap.categories.length})` : `${typeof snap.categories}`,
      catalogKeys: Object.keys(snap.catalog ?? {}),
      catalogValueIsArray: Array.isArray(snap.catalog?.value),
      catalogPhase: snap.catalog?.phase,
      runtimesPhase: snap.runtimes?.phase,
      tIsFunction: typeof props.t,
      localeHasSnapshot: typeof props.locale?.getSnapshot,
    }
  } catch (error) {
    outcome.probe = { probeError: `${error?.stack ?? error}` }
  }

  // Every distinct snapshot object the component can read, plus the exact value
  // of the field the crash names. A missing collection shows up here.
  outcome.snapshotLog = []
  try {
    const originalGetSnapshot = props.controller.getSnapshot
    const seenSnapshots = new Set()
    props.controller.getSnapshot = () => {
      const snap = originalGetSnapshot()
      if (!seenSnapshots.has(snap)) {
        seenSnapshots.add(snap)
        outcome.snapshotLog.push({
          categories: Array.isArray(snap.categories) ? `array(${snap.categories.length})` : `${typeof snap.categories}`,
          catalogPhase: snap.catalog?.phase,
          catalogValue: Array.isArray(snap.catalog?.value) ? `array(${snap.catalog.value.length})` : `${typeof snap.catalog?.value}`,
          tab: snap.tab,
        })
      }
      return snap
    }
  } catch (error) {
    outcome.snapshotLog.push({ hookError: `${error?.stack ?? error}` })
  }

  // Instrument the API facade the controller actually holds: what does
  // catalogCategories() really resolve to at runtime?
  outcome.apiLog = []
  try {
    const api = props.controller.api ?? props.controller['api']
    if (api && typeof api.catalogCategories === 'function') {
      const original = api.catalogCategories.bind(api)
      api.catalogCategories = async () => {
        try {
          const value = await original()
          outcome.apiLog.push({
            call: 'catalogCategories',
            resolvedType: Array.isArray(value) ? `array(${value.length})` : `${typeof value}`,
            stack: new Error('catalogCategories resolved here').stack,
          })
          return value
        } catch (error) {
          outcome.apiLog.push({ call: 'catalogCategories', threw: `${error?.stack ?? error}` })
          throw error
        }
      }
    } else {
      outcome.apiLog.push({ note: 'controller.api is not reachable from the harness', keys: Object.keys(props.controller) })
    }
  } catch (error) {
    outcome.apiLog.push({ hookError: `${error?.stack ?? error}` })
  }

  try {
    act(() => {
      // Real element creation (React.createElement), not a direct call: a direct
      // call would run the component outside React's dispatcher and fake an
      // "Invalid hook call" that says nothing about the plugin.
      root.render(createElement(Comp, props))
    })
  } catch (error) {
    outcome.error = `${error?.stack ?? error}`
  }

  if (!outcome.error) {
    try {
      await act(async () => {
        await flush()
      })
    } catch (error) {
      outcome.error = `${error?.stack ?? error}`
    }
  }
  outcome.html = container.innerHTML
  outcome.fetchCalls = fetchCalls.slice()
  report.panels[label] = outcome
  try {
    act(() => root.unmount())
  } catch {
    /* leaving it mounted is fine; the page is already dead */
  }
  container.remove()
  // Stop the controller's poll timers so the process can exit.
  props.controller?.dispose?.()
  return outcome
}

// A valid host response so a missing backend can never be mistaken for the bug.
// Envelope is the one the host's own route documents (src/host/http.ts:18):
// `{ ok: true, value: <result> }`. Nothing here is JSON-RPC.
const fetchCalls = []

/** Per-method value the fake host answers with — shaped like the real thing. */
function hostValue(method) {
  switch (method) {
    case 'listServers':
      return []
    case 'listSecretNames':
      return []
    case 'catalogCategories':
      return []
    case 'detectRuntimes':
      return { node: true, npx: true, uvx: false, bunx: false }
    case 'catalog':
      return { entries: [], total: 0, registryOnline: true }
    default:
      return null
  }
}

let fetchImpl
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  writable: true,
  value: async (url, init = {}) => {
    let method = '?'
    try {
      method = JSON.parse(init.body)?.method ?? '?'
    } catch {
      /* not one of this plugin's calls */
    }
    const value = hostValue(method)
    const responseBody = { ok: true, value: value === undefined ? null : value }
    fetchCalls.push({ method, valueType: Array.isArray(value) ? `array(${value.length})` : typeof value })
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => responseBody,
      text: async () => JSON.stringify(responseBody),
    }
  },
})
fetchImpl = globalThis.fetch

// ----------------------------------------------------------------- run -------
const results = {}
try {
  // Variant A — the REAL service contract: getSnapshot returns the SAME frozen
  // object every call (dsh-client-locale lib/client.js:1250). This is what the
  // panel receives inside the real shell through `inject: () => face`.
  results.stableLocale = await mountAndRender({
    label: 'stable-locale (real LocaleRuntime contract)',
    localeFactory: () => createLocaleStandIn('fa'),
  })

  // Variant B — the values the repo's OWN component tests pass: a fresh object
  // literal from getSnapshot (`tests/client/render.test.tsx:22-23`).
  results.freshLocale = await mountAndRender({
    label: 'fresh-object-locale (tests/client/render.test.tsx:22)',
    localeFactory: () => ({
      getSnapshot: () => ({ active: 'fa' }),
      subscribe: () => () => undefined,
      register: () => () => undefined,
      addLanguage: () => () => undefined,
      bind: () => (key) => key,
    }),
  })
} catch (error) {
  report.errors.push(`${error?.stack ?? error}`)
}

report.html = JSON.stringify(
  Object.fromEntries(Object.entries(report.panels).map(([k, v]) => [k, { error: v.error, htmlLength: v.html.length, html: v.html }])),
  null,
  2,
)
report.windowErrors = windowErrors.map((e) => ({ type: e.type, message: e.message, stack: e.error?.stack }))

console.log = realConsole.log
console.warn = realConsole.warn
console.error = realConsole.error

process.stdout.write(`\n${'='.repeat(78)}\nHARNESS REPORT — ${ENTRY_ID}\n${'='.repeat(78)}\n`)
process.stdout.write(JSON.stringify(report, null, 2))
process.stdout.write('\n')
// UTF-8 sidecar so the report can be read without console re-encoding.
writeReport()
