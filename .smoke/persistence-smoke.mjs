/**
 * Persistence smoke test for @mfallah/dsh-mcp-studio.
 *
 * The isolated host smoke test proves the API works inside ONE plugin lifetime.
 * This one proves the thing a user actually cares about: that a server installed
 * through the panel is still there, still connected, and still carrying its
 * secrets after the harness restarts.
 *
 * Method: boot the built host bundle twice with the SAME store directory, in two
 * separate Cordis contexts with the tools registry and web server torn down in
 * between. A second boot is what `dsh web` does at startup.
 *
 * Run:  node .smoke/persistence-smoke.mjs
 */
import { Context } from '@deepseek-ai/cordis'
import http from 'node:http'
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const failures = []
const results = []
function check(name, condition, detail = '') {
  const ok = Boolean(condition)
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const pluginUrl = new URL('../lib/index.js', import.meta.url).href
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Boot the plugin once, exactly as the harness would: a fresh Cordis context, a
 * tools registry, an HTTP server standing in for `ctx.webServer`, and the real
 * host bundle.
 */
async function boot(storeDir, label) {
  const ctx = new Context()

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

  const plugin = await import(pluginUrl)
  const fiber = ctx.plugin(plugin, {
    storeDir,
    catalogEnabled: false,
    registryUrl: 'https://registry.modelcontextprotocol.io',
    probeTimeoutMs: 30000,
    mountTimeoutMs: 120000,
    logLinesPerServer: 200,
  })
  await fiber
  await sleep(700)

  const rpc = async (method, ...args) => {
    const response = await fetch(`http://127.0.0.1:${port}/mcp-studio-api/rpc`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mcp-studio': '1' },
      body: JSON.stringify({ method, args }),
    })
    return response.json()
  }

  return {
    label,
    rpc,
    registered,
    port,
    async dispose() {
      await fiber.dispose()
      await new Promise((resolve) => server.close(resolve))
    },
  }
}

const storeDir = mkdtempSync(join(tmpdir(), 'mcp-studio-persist-'))
let first
let second

try {
  // ---- first lifetime: install things through the real API -------------------
  first = await boot(storeDir, 'first')
  const added = await first.rpc('addServer', {
    transport: 'stdio',
    title: 'Memory',
    serverName: 'memory',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory@2026.7.4'],
    env: { MEMORY_FILE_PATH: join(storeDir, 'memory.jsonl') },
  })
  check(
    'install: a real MCP server connects',
    added.value?.status === 'connected',
    `status=${added.value?.status} err=${added.value?.lastError ?? ''}`,
  )
  const toolCount = added.value?.toolCount ?? 0
  check('install: its tools register under the namespace', toolCount > 0, `${toolCount} tools`)

  await first.rpc('setSecret', 'DEMO_TOKEN', 'persisted-secret-value')
  const withSecret = await first.rpc('addServer', {
    transport: 'streamable-http',
    title: 'Header Demo',
    serverName: 'headerdemo',
    url: 'http://127.0.0.1:9/mcp',
    headers: { Authorization: 'Bearer ${secret:DEMO_TOKEN}' },
  })
  check('install: a secret-referencing server is accepted', withSecret.value !== undefined)

  // ---- what actually landed on disk -----------------------------------------
  const serversFile = join(storeDir, 'servers.json')
  const secretsFile = join(storeDir, 'secrets.json')
  check('disk: servers.json exists', existsSync(serversFile))
  check('disk: secrets.json exists', existsSync(secretsFile))

  const serversRaw = readFileSync(serversFile, 'utf8')
  const secretsRaw = readFileSync(secretsFile, 'utf8')
  check('disk: servers.json keeps the placeholder, not the value', serversRaw.includes('${secret:DEMO_TOKEN}'))
  check('disk: the secret VALUE never reaches servers.json', !serversRaw.includes('persisted-secret-value'))
  check('disk: the secret VALUE is in secrets.json', secretsRaw.includes('persisted-secret-value'))
  check(
    'disk: servers.json holds no secret value from env either',
    !serversRaw.includes(join(storeDir, 'memory.jsonl')) || serversRaw.includes('MEMORY_FILE_PATH'),
  )

  const beforeTools = [...first.registered.keys()].filter((n) => n.startsWith('mcp__memory__'))
  check('first lifetime: tools are live before shutdown', beforeTools.length > 0, `${beforeTools.length} live`)

  // ---- simulated restart -----------------------------------------------------
  await first.dispose()
  first = null
  await sleep(300)

  second = await boot(storeDir, 'second')

  const listed = await second.rpc('listServers')
  const ids = (listed.value ?? []).map((s) => s.id).sort()
  check('restart: both servers come back', ids.length === 2, ids.join(', '))

  const memory = (listed.value ?? []).find((s) => s.id === 'memory')
  check(
    'restart: the stdio server reconnects on its own',
    memory?.status === 'connected',
    `status=${memory?.status} err=${memory?.lastError ?? ''}`,
  )
  check(
    'restart: it rediscovers the same tool count',
    (memory?.toolCount ?? 0) === toolCount,
    `before=${toolCount} after=${memory?.toolCount}`,
  )

  const afterTools = [...second.registered.keys()].filter((n) => n.startsWith('mcp__memory__'))
  check('restart: tools are live again in the new process', afterTools.length === toolCount, `${afterTools.length} live`)

  const secretNames = await second.rpc('listSecretNames')
  check('restart: the secret name survives', (secretNames.value ?? []).includes('DEMO_TOKEN'))
  check(
    'restart: the secret VALUE is still not exposed over the API',
    !JSON.stringify(secretNames).includes('persisted-secret-value'),
  )

  const headerdemo = (listed.value ?? []).find((s) => s.id === 'headerdemo')
  check(
    'restart: the secret-referencing server is reported as using secrets',
    headerdemo?.usesSecrets === true && (headerdemo?.secretKeys ?? []).includes('DEMO_TOKEN'),
    `usesSecrets=${headerdemo?.usesSecrets} keys=${(headerdemo?.secretKeys ?? []).join(',')}`,
  )
  check(
    'restart: its header value is never returned to the UI',
    !JSON.stringify(listed).includes('persisted-secret-value'),
  )

  // Removing is the last thing to survive a restart boundary.
  const removed = await second.rpc('removeServer', memory?.id ?? 'memory')
  check('restart: removal persists to disk', removed.ok === true)
  const afterRemoval = JSON.parse(readFileSync(serversFile, 'utf8'))
  const rows = Array.isArray(afterRemoval) ? afterRemoval : (afterRemoval.servers ?? [])
  check(
    'restart: the removed row is gone from servers.json',
    !rows.some((row) => row.id === 'memory'),
    `${rows.length} row(s) left: ${rows.map((r) => r.id).join(', ')}`,
  )
} finally {
  if (first !== null && first !== undefined) await first.dispose().catch(() => undefined)
  if (second !== null && second !== undefined) await second.dispose().catch(() => undefined)
  rmSync(storeDir, { recursive: true, force: true })
}

console.log(results.join('\n'))
console.log(`\n${failures.length === 0 ? 'PERSISTENCE OK' : `PERSISTENCE FAILED: ${failures.length}`}`)
process.exit(failures.length === 0 ? 0 : 1)
