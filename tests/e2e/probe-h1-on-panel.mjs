/**
 * probe-h1-on-panel.mjs — drive the REAL built `McpStudioPanel` through H1.
 *
 * The minimal probe showed React 18.3.1 only loops when `getSnapshot`'s RETURN
 * VALUE is a fresh object each call. The shipped panel's `useDirection` returns
 * a string (`locale.getSnapshot().active`). This runs both shapes through the
 * real component to record which one white-screens.
 *
 * RUN: node tests/e2e/probe-h1-on-panel.mjs
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

const errors = []
const origError = console.error
console.error = (...args) => errors.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(' '))

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

const { act, createElement } = require('react')
const { createRoot } = require('react-dom/client')

/** Locale stand-in. `objectValue` makes getSnapshot's RETURN a fresh object. */
function makeLocale({ objectValue }) {
  const frozen = Object.freeze({ active: 'fa', locales: [], revision: 0 })
  return {
    register: () => () => undefined,
    addLanguage: () => () => undefined,
    bind: () => (key) => key,
    subscribe: () => () => undefined,
    getSnapshot: () => (objectValue ? { active: 'fa', locales: [], revision: 0 } : frozen),
  }
}

for (const objectValue of [false, true]) {
  errors.length = 0
  const locale = makeLocale({ objectValue })
  const registrations = []
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
  mod.apply(ctx)
  const main = registrations.find((r) => r.options?.name === 'main')
  const props = { t: (key) => key, ...main.options.inject() }

  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  let thrown = null
  try {
    await act(async () => {
      root.render(createElement(main.component, props))
      await new Promise((r) => setTimeout(r, 60))
    })
  } catch (error) {
    thrown = `${error?.stack ?? error}`
  }
  const html = container.innerHTML
  console.log(`\n=== panel, getSnapshot returns ${objectValue ? 'a NEW OBJECT' : "the SAME frozen object"} ===`)
  console.log('thrown      :', thrown ? thrown.split('\n')[0] : 'none')
  console.log('console.error:', errors.length)
  for (const e of errors) console.log('   -', e.split('\n')[0])
  console.log('htmlLength  :', html.length, html.length === 0 ? '  <-- WHITE PAGE' : '')
  if (thrown) console.log('FULL STACK:\n' + thrown)
  try {
    act(() => root.unmount())
  } catch {
    /* ignore */
  }
  props.controller?.dispose?.()
  container.remove()
}
console.error = origError
