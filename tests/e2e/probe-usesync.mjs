/**
 * probe-usesync.mjs — does React 18.3.1 throw for an uncached `getSnapshot`?
 *
 * H1/H2 claim the blank page comes from `useSyncExternalStore` receiving a
 * getSnapshot that returns a new object every call. This drives that exact call
 * shape through the repo's own React, with and without a re-render.
 *
 * RUN: node tests/e2e/probe-usesync.mjs
 */
import { createRequire } from 'node:module'
import { resolve as pathResolve } from 'node:path'

const REPO = pathResolve(import.meta.dirname ?? 'F:/harness/dsh-mcp-studio/tests/e2e', '..', '..')
const require = createRequire(pathResolve(REPO, 'package.json'))
const { JSDOM } = require('jsdom')
const dom = new JSDOM('<body><div id="root"></div></body>', { pretendToBeVisual: true, url: 'http://127.0.0.1:3080/' })

globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true })
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const { act, createElement, useState, useSyncExternalStore } = require('react')
const { createRoot } = require('react-dom/client')

const errors = []
const warnings = []
const origError = console.error
const origWarn = console.warn
console.error = (...a) => {
  errors.push(a.map((x) => (x instanceof Error ? x.message : String(x))).join(' '))
}
console.warn = (...a) => {
  warnings.push(a.map(String).join(' '))
}

/** Mirrors src/client/panel/McpStudioPage.tsx:39-46 exactly. */
let snapshotCalls = 0
function useDirection(locale) {
  const active = useSyncExternalStore(
    locale?.subscribe ?? (() => () => undefined),
    () => {
      snapshotCalls += 1
      return locale?.getSnapshot().active ?? 'en'
    },
    () => 'en',
  )
  return active.startsWith('fa') || active.startsWith('ar') ? 'rtl' : 'ltr'
}

let renderCalls = 0
function Probe({ locale, bump }) {
  renderCalls += 1
  const dir = useDirection(locale)
  const [n, setN] = useState(0)
  if (bump && n === 0) setN(1)
  return createElement('div', { 'data-dir': dir }, String(n))
}

async function run(label, locale, bump) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const before = errors.length
  snapshotCalls = 0
  renderCalls = 0
  let thrown = null
  try {
    await act(async () => {
      root.render(createElement(Probe, { locale, bump }))
      await new Promise((r) => setTimeout(r, 30))
    })
  } catch (error) {
    thrown = `${error?.message}`
  }
  const html = container.innerHTML
  const stats = { renderCalls, snapshotCalls }
  try {
    act(() => root.unmount())
  } catch {
    /* already dead */
  }
  container.remove()
  console.log(
    `[${label}] thrown=${thrown} html=${JSON.stringify(html)} newErrors=${errors.length - before} renders=${stats.renderCalls} getSnapshotCalls=${stats.snapshotCalls}`,
  )
  for (const e of errors.slice(before)) console.log(`    console.error: ${e.split('\n')[0]}`)
  return { label, thrown, html, newErrors: errors.length - before, ...stats }
}

// A — the REAL contract: one frozen object until it changes.
const frozen = Object.freeze({ active: 'fa', locales: [], revision: 0 })
const stableLocale = { getSnapshot: () => frozen, subscribe: () => () => undefined }
await run('stable snapshot', stableLocale, false)

// B — src/tests/client/render.test.tsx:22 shape: a brand-new object literal.
const freshLocale = { getSnapshot: () => ({ active: 'fa' }), subscribe: () => () => undefined }
await run('fresh object literal', freshLocale, false)

// C — same, but forced through a second render (where React re-validates).
await run('fresh object literal + re-render', { getSnapshot: () => ({ active: 'fa', locales: [], revision: 0 }), subscribe: () => () => undefined }, true)

// D — unbound methods, H2: subscribe/getSnapshot depend on `this`.
const thisBound = {
  active: 'fa',
  getSnapshot() {
    return { active: this.active, locales: [], revision: 0 }
  },
  subscribe() {
    return () => undefined
  },
}
await run('unbound this-dependent methods', thisBound, false)

// E — a getSnapshot whose VALUE is a new object every call: the literal H1 shape
// ("getSnapshot returns a NEW object every call"). This is the case React's
// "should be cached" guard exists for.
function useObjectSnapshot(locale) {
  const snap = useSyncExternalStore(
    locale?.subscribe ?? (() => () => undefined),
    () => ({ active: locale?.getSnapshot().active ?? 'en' }),
    () => ({ active: 'en' }),
  )
  const active = snap.active
  return active.startsWith('fa') || active.startsWith('ar') ? 'rtl' : 'ltr'
}
let objectRenderCalls = 0
function ObjectProbe({ locale }) {
  objectRenderCalls += 1
  const dir = useObjectSnapshot(locale)
  return createElement('div', { 'data-dir': dir }, 'x')
}
{
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const before = errors.length
  objectRenderCalls = 0
  let thrown = null
  try {
    await act(async () => {
      root.render(createElement(ObjectProbe, { locale: { getSnapshot: () => frozen, subscribe: () => () => undefined } }))
      await new Promise((r) => setTimeout(r, 50))
    })
  } catch (error) {
    thrown = `${error?.message}`
  }
  console.log(
    `[object value, uncached] thrown=${thrown} html=${JSON.stringify(container.innerHTML)} newErrors=${errors.length - before} renders=${objectRenderCalls}`,
  )
  for (const e of errors.slice(before)) console.log(`    console.error: ${e.split('\n')[0]}`)
  if (thrown) console.log('FULL STACK:\n' + thrown)
  try {
    act(() => root.unmount())
  } catch {
    /* ignore */
  }
  container.remove()
}

console.error = origError
console.warn = origWarn
console.log('\nall console.error messages:', errors.length)
for (const e of errors) console.log(' -', e.split('\n')[0])
