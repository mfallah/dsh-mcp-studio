/**
 * Isolated host smoke test for @mfallah/dsh-mcp-studio.
 *
 * Boots the built host bundle in a REAL Cordis runtime with:
 *   - a fake `tools` service that records registrations (the only API the MCP
 *     bridge uses is `register`),
 *   - a real node:http server standing in for `ctx.webServer`,
 * and then drives the plugin's real HTTP API end to end, including mounting a
 * REAL MCP server through the real @deepseek-ai/dsh-mcp-client bridge.
 *
 * Run:  node F:\harness\.smoke\host-smoke.mjs
 */
import { Context } from '@deepseek-ai/cordis'
import http from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const failures = []
const results = []
function check(name, condition, detail = '') {
  const ok = Boolean(condition)
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const ctx = new Context()

// --- fake tools registry -----------------------------------------------------
const registered = new Map()
ctx.provide('tools', {
  register(definition) {
    registered.set(definition.name, definition)
    return () => registered.delete(definition.name)
  },
  schemas() {
    return [...registered.values()].map((d) => ({ name: d.name, description: d.description }))
  },
})

// --- real http server behind a webServer-shaped service ----------------------
const routes = []
const server = http.createServer((req, res) => {
  let pathname = '/'
  try {
    pathname = new URL(req.url, 'http://127.0.0.1').pathname
  } catch {
    res.statusCode = 400
    res.end('bad url')
    return
  }
  const exact = routes.find((r) => r.kind === 'exact' && r.path === pathname)
  const prefix = routes
    .filter((r) => r.kind === 'prefix' && (pathname === r.path || pathname.startsWith(`${r.path}/`)))
    .sort((a, b) => b.path.length - a.path.length)[0]
  const route = exact ?? prefix
  if (route === undefined) {
    res.statusCode = 404
    res.end('no route')
    return
  }
  Promise.resolve(route.handler(req, res)).catch((error) => {
    res.statusCode = 500
    res.end(String(error))
  })
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
ctx.provide('webServer', {
  register(route) {
    routes.push(route)
    return () => {
      const index = routes.indexOf(route)
      if (index >= 0) routes.splice(index, 1)
    }
  },
  get port() {
    return port
  },
})

// --- boot the plugin ---------------------------------------------------------
const storeDir = mkdtempSync(join(tmpdir(), 'mcp-studio-smoke-'))
const plugin = await import(new URL('../lib/index.js', import.meta.url).href)
check('host bundle exports apply', typeof plugin.apply === 'function')
check('host bundle exports name mcp-studio', plugin.name === 'mcp-studio')
check('host bundle has NO default export (inject-metadata footgun)', plugin.default === undefined)
check('host bundle exports a Config schema', plugin.Config !== undefined)

const fiber = ctx.plugin(plugin, {
  storeDir,
  catalogEnabled: false,
  registryUrl: 'https://registry.modelcontextprotocol.io',
  probeTimeoutMs: 20000,
  mountTimeoutMs: 120000,
  logLinesPerServer: 200,
})
await fiber
await new Promise((resolve) => setTimeout(resolve, 500))
check('route /mcp-studio-api registered', routes.some((r) => r.path === '/mcp-studio-api'))

const base = `http://127.0.0.1:${port}`
async function rpc(method, ...args) {
  const response = await fetch(`${base}/mcp-studio-api/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mcp-studio': '1' },
    body: JSON.stringify({ method, args }),
  })
  return { status: response.status, body: await response.json() }
}

// --- health ------------------------------------------------------------------
const health = await fetch(`${base}/mcp-studio-api/health`)
const healthBody = await health.json()
check('GET /health answers 200', health.status === 200)
check('health reports the package name', healthBody.name === '@mfallah/dsh-mcp-studio', JSON.stringify(healthBody))

// --- guard -------------------------------------------------------------------
const unguarded = await fetch(`${base}/mcp-studio-api/rpc`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ method: 'listServers', args: [] }),
})
check('missing guard header is refused', unguarded.status === 403, `status ${unguarded.status}`)
const unknown = await rpc('notAMethod')
check('unknown method is refused', unknown.body.ok === false && unknown.body.error?.code === 'unknown-method')

// --- empty state -------------------------------------------------------------
const empty = await rpc('listServers')
check('listServers starts empty', empty.body.ok === true && empty.body.value.length === 0)

const runtimes = await rpc('detectRuntimes')
check('detectRuntimes reports npx availability', runtimes.body.ok === true && runtimes.body.value?.npx?.available === true, JSON.stringify(runtimes.body.value?.npx))

// --- real MCP server through the real bridge ---------------------------------
const added = await rpc('addServer', {
  transport: 'stdio',
  title: 'Memory',
  serverName: 'memory',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-memory@2026.7.4'],
  env: { MEMORY_FILE_PATH: join(storeDir, 'memory.jsonl') },
  toolCallTimeoutMs: 30000,
})
check('addServer succeeds', added.body.ok === true, JSON.stringify(added.body).slice(0, 400))
const memory = added.body.value
check('added server is connected', memory?.status === 'connected', `status=${memory?.status} error=${memory?.lastError}`)
check('added server reports tools', (memory?.toolCount ?? 0) > 0, `toolCount=${memory?.toolCount}`)
check(
  'tools are registered under mcp__memory__*',
  [...registered.keys()].some((name) => name.startsWith('mcp__memory__')),
  [...registered.keys()].slice(0, 5).join(', '),
)

const detail = await rpc('getServer', memory?.id)
check('getServer returns the config and logs', detail.body.ok === true && Array.isArray(detail.body.value?.logs) && detail.body.value.logs.length > 0)

const logs = await rpc('getLogs', memory?.id, 0)
check('getLogs returns sequenced entries', logs.body.ok === true && logs.body.value.entries.every((e) => typeof e.seq === 'number'))

// --- persistence across a plugin reload --------------------------------------
const disabled = await rpc('setEnabled', memory?.id, false)
check('setEnabled(false) marks it disabled', disabled.body.value?.status === 'disabled')
check('disabling removes the tools from the registry', ![...registered.keys()].some((n) => n.startsWith('mcp__memory__')))
const reEnabled = await rpc('setEnabled', memory?.id, true)
check('setEnabled(true) reconnects', reEnabled.body.value?.status === 'connected', `status=${reEnabled.body.value?.status}`)

const probe = await rpc('testConnection', {
  transport: 'stdio',
  title: 'Probe',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-memory@2026.7.4'],
  env: { MEMORY_FILE_PATH: join(storeDir, 'probe.jsonl') },
})
check('testConnection succeeds against the real server', probe.body.value?.ok === true, probe.body.value?.error ?? '')
check('testConnection did not leak a registration', ![...registered.keys()].some((n) => n.startsWith('mcp__probe-')))

const badProbe = await rpc('testConnection', { transport: 'stdio', title: 'Bad', command: 'definitely-not-a-command-xyz', args: [] })
check('testConnection reports a missing command as a failure', badProbe.body.value?.ok === false, badProbe.body.value?.code ?? '')

// --- secrets -----------------------------------------------------------------
await rpc('setSecret', 'DEMO_TOKEN', 'shhh')
const names = await rpc('listSecretNames')
check('setSecret stores a name', names.body.value?.includes('DEMO_TOKEN'))
const withSecret = await rpc('addServer', {
  transport: 'streamable-http',
  title: 'Header Demo',
  serverName: 'headerdemo',
  url: 'http://127.0.0.1:9/mcp',
  headers: { Authorization: 'Bearer ${secret:DEMO_TOKEN}' },
})
check('a secret reference is accepted', withSecret.body.ok === true, JSON.stringify(withSecret.body).slice(0, 200))
check('the secret VALUE is never returned', !JSON.stringify(withSecret.body).includes('shhh'))
const inUse = await rpc('deleteSecret', 'DEMO_TOKEN')
check('deleting an in-use secret is refused', inUse.body.ok === false && inUse.body.error?.code === 'secret-in-use')

// --- catalog (offline) -------------------------------------------------------
const catalog = await rpc('catalog', { text: '' })
check('catalog works with the registry disabled', catalog.body.ok === true && catalog.body.value.entries.length > 0, `entries=${catalog.body.value?.entries?.length}`)
const categories = await rpc('catalogCategories')
check('catalogCategories returns tags', categories.body.ok === true && categories.body.value.length > 0)

const exportPatch = await rpc('exportPatch')
check('exportPatch renders YAML', exportPatch.body.ok === true && exportPatch.body.value.includes('dsh-mcp-client'))

// --- regression guards for defects found by independent verification ---------
// D1: re-testing an ALREADY INSTALLED server must work. The probe has to use a
// throwaway name, not the draft's real one, or the duplicate-name guard refuses
// exactly the case a user is most likely to try.
const reProbe = await rpc('testConnection', {
  transport: 'stdio',
  title: 'Memory (re-test)',
  serverName: 'memory',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-memory@2026.7.4'],
  env: { MEMORY_FILE_PATH: join(storeDir, 'reprobe.jsonl') },
})
check(
  'D1 testConnection accepts an already-installed serverName',
  reProbe.body.value?.ok === true,
  reProbe.body.value?.error ?? '',
)

// D2: an oversized body must be answered with 413, not a connection reset.
const oversized = await fetch(`${base}/mcp-studio-api/rpc`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-mcp-studio': '1' },
  body: JSON.stringify({ method: 'listServers', args: [], pad: 'x'.repeat(2 * 1024 * 1024) }),
}).catch((error) => ({ status: 0, statusText: String(error) }))
check('D2 an oversized body answers 413', oversized.status === 413, `status ${oversized.status}`)

// D3: an over-long serverName must be refused, never silently truncated.
const longName = await rpc('addServer', {
  transport: 'stdio',
  title: 'Too Long',
  serverName: 'a'.repeat(33),
  command: 'npx',
  args: [],
})
check(
  'D3 an over-long serverName is refused, not truncated',
  longName.body.ok === false && longName.body.error?.code === 'invalid-server-name',
  JSON.stringify(longName.body).slice(0, 160),
)

// D5: an unknown transport must be refused, never silently coerced to stdio.
const badTransport = await rpc('addServer', { transport: 'sse', title: 'Nope', command: 'npx' })
check(
  'D5 an unknown transport is refused',
  badTransport.body.ok === false && badTransport.body.error?.code === 'invalid-transport',
  JSON.stringify(badTransport.body).slice(0, 160),
)

// --- removal -----------------------------------------------------------------
const removed = await rpc('removeServer', memory?.id)
check('removeServer succeeds', removed.body.ok === true)
const after = await rpc('listServers')
check('removed server is gone', after.body.value.every((s) => s.id !== memory?.id))

await fiber.dispose()
server.close()
rmSync(storeDir, { recursive: true, force: true })

console.log(results.join('\n'))
console.log(`\n${failures.length === 0 ? 'SMOKE OK' : `SMOKE FAILED: ${failures.length}`}`)
process.exit(failures.length === 0 ? 0 : 1)
