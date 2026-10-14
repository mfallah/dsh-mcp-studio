/** trace-rpc.mjs — instrument the compiled transport in memory to see payload shape. */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve as pathResolve } from 'node:path'

const REPO = pathResolve(import.meta.dirname ?? 'F:/harness/dsh-mcp-studio/tests/e2e', '..', '..')
const require = createRequire(pathResolve(REPO, 'package.json'))
const { JSDOM } = require('jsdom')
const dom = new JSDOM('<body></body>', { pretendToBeVisual: true, url: 'http://127.0.0.1:3080/' })
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true, writable: true })

const registry = new Map()
const cache = new Map()
function lr(spec) {
  if (cache.has(spec)) return cache.get(spec).exports
  const factory = registry.get(spec)
  if (factory) {
    const module = { exports: {} }
    cache.set(spec, module)
    module.exports = factory(lr)
    return module.exports
  }
  const exports = require(spec)
  cache.set(spec, { exports })
  return exports
}
globalThis.__ModuleLoader__ = { load: ({ id, factory }) => registry.set(id, factory) }
dom.window.__ModuleLoader__ = globalThis.__ModuleLoader__

const TRACE = []
globalThis.__TRACE__ = TRACE

let src = readFileSync(pathResolve(REPO, 'lib', 'client.js'), 'utf8')
const needle = '        let payload;\n        try {\n          payload = await response.json();'
if (!src.includes(needle)) throw new Error('rpc needle not found')
src = src.replace(
  needle,
  `${needle}\n          try { globalThis.__TRACE__.push({ where: 'rpc', payloadJson: JSON.stringify(payload), valueJson: JSON.stringify(payload && payload.value), ownValue: Object.getOwnPropertyNames(payload).join(','), desc: JSON.stringify(Object.getOwnPropertyDescriptor(payload, 'value') ? 'has' : 'absent') }); } catch (e) { globalThis.__TRACE__.push({ where: 'rpc-instrument-failed', message: String(e && e.message) }); }`,
)
// Also trace the transport return.
const ret = '        return payload.value;'
if (!src.includes(ret)) throw new Error('return needle not found')
src = src.replace(ret, `        globalThis.__TRACE__.push({ where: 'return', returning: payload.value });\n${ret}`)

new Function('window', 'globalThis', 'module', 'exports', 'require', `${src}\nreturn module.exports;`)(dom.window, globalThis, { exports: {} }, {}, lr)
const mod = lr('@mfallah/dsh-mcp-studio')

globalThis.fetch = async () => {
  const body = { jsonrpc: '2.0', id: 1, result: { ok: true, value: ['x'] } }
  return { ok: true, status: 200, json: async () => body }
}

const transport = mod.createHttpTransport()
const value = await transport('catalogCategories', [])
console.log('TRACE:', JSON.stringify(TRACE))
console.log('transport returned:', JSON.stringify(value))
