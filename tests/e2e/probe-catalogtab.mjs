/**
 * probe-catalogtab.mjs — isolate which field of the `snapshot` prop a child
 * component dereferences when it throws "Cannot read properties of undefined".
 *
 * RUN: node tests/e2e/probe-catalogtab.mjs
 */
import { readFileSync } from 'node:fs'
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

const registry = new Map()
const moduleCache = new Map()
function loaderRequire(spec) {
  if (moduleCache.has(spec)) return moduleCache.get(spec).exports
  const entry = registry.get(spec)
  if (entry !== undefined) {
    const module = { exports: {} }
    moduleCache.set(spec, module)
    module.exports = entry(loaderRequire)
    return module.exports
  }
  const exports = require(spec)
  moduleCache.set(spec, { exports })
  return exports
}
const ModuleLoader = {
  load({ id, factory }) {
    registry.set(id, factory)
  },
  materialize: (id) => loaderRequire(id),
}
globalThis.__ModuleLoader__ = ModuleLoader
dom.window.__ModuleLoader__ = ModuleLoader

const ENTRY = '@mfallah/dsh-mcp-studio'
const file = pathResolve(REPO, 'lib', 'client.js')
const source = readFileSync(file, 'utf8')
// eslint-disable-next-line no-new-func
new Function('window', 'globalThis', 'module', 'exports', 'require', `${source}\nreturn module.exports;\n//# sourceURL=${file}`)(
  dom.window,
  globalThis,
  { exports: {} },
  {},
  loaderRequire,
)
const mod = loaderRequire(ENTRY)

// Reach into the bundle the same way the page does: run apply() and take the
// component it registered, then render THAT component directly with a snapshot
// whose every field is instrumented.
const locale = {
  register: () => () => undefined,
  addLanguage: () => () => undefined,
  bind: () => (key) => key,
  getSnapshot: () => Object.freeze({ active: 'en', locales: [], revision: 0 }),
  subscribe: () => () => undefined,
}
const registered = []
const declared = []
const ctx = {
  slots: {
    // Declaration-aware inject, like the real SlotsCore: a generator body is
    // drained and its yielded registration is what the entry gets.
    inject: (name, contribute) => {
      declared.push(name)
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
      registered.push(handle)
      return handle
    },
    declare: (name) => declared.push(`declare:${name}`),
  },
  locale,
  layout: {},
  effect: (fn) => {
    const d = fn()
    return () => typeof d === 'function' && d()
  },
}
const yields = []
const origRegister = ctx.slots.register
ctx.slots.register = (options, component) => {
  yields.push({ name: options?.name, key: options?.key, id: options?.id, component: component?.name })
  return origRegister(options, component)
}
mod.apply(ctx)
console.log('declared:', declared.join(', '))
console.log('registered:', JSON.stringify(yields))
const page = registered.find((r) => r.options?.name === 'main')
if (!page) throw new Error(`no main component captured; got ${JSON.stringify(registered.map((r) => r.options?.name))}`)

const { act, createElement } = require('react')
const { createRoot } = require('react-dom/client')

// Same valid RPC envelope as the main harness.
globalThis.fetch = async (url, init = {}) => {
  let method = '?'
  try {
    method = JSON.parse(init.body)?.method ?? '?'
  } catch {
    /* ignore */
  }
  const value = []
  console.log('FETCH', method)
  const body = { jsonrpc: '2.0', id: 1, result: { ok: true, value } }
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

// Drive the controller through the same lifecycle the panel triggers, then look
// at what the state actually holds.
const controller = new mod.McpStudioController({ api: mod.createStudioApi() })
controller.setVisible(true)
await new Promise((r) => setTimeout(r, 20))
const snap = controller.getSnapshot()
console.log('state.categories after loadAll:', Array.isArray(snap.categories) ? `array(${snap.categories.length})` : String(snap.categories))
console.log('state.catalog.phase:', snap.catalog.phase, 'value:', Array.isArray(snap.catalog.value) ? `array(${snap.catalog.value.length})` : String(snap.catalog.value))
console.log('servers.phase:', snap.servers.phase, 'runtimes.phase:', snap.runtimes.phase, 'secrets.phase:', snap.secrets.phase)
controller.dispose()
