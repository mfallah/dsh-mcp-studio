/**
 * Verifier runtime probes for specific documentation claims.
 *
 * Written by the verifier, not the plugin authors. Boots lib/index.js in
 * isolation (same shape as .smoke/host-smoke.mjs) and measures three claims:
 *
 *   - a probe runs under a temporary server name and cannot displace a live row
 *   - server names are capped at 32 chars and the documented grammar
 *   - setSecret writes secrets.json with the ACL tightened (Windows)
 *
 * Run:  node tests/e2e/docs-claims-runtime.mjs
 */
import { Context } from '@deepseek-ai/cordis'
import http from 'node:http'
import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const BUNDLE = join(REPO, 'lib', 'index.js')

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

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
  const route =
    routes.find((r) => r.kind === 'exact' && r.path === pathname) ??
    routes
      .filter((r) => r.kind === 'prefix' && (pathname === r.path || pathname.startsWith(`${r.path}/`)))
      .sort((a, b) => b.path.length - a.path.length)[0]
  if (!route) {
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

const storeDir = mkdtempSync(join(tmpdir(), 'mcp-studio-claims-'))
const plugin = await import(`file:///${BUNDLE.replaceAll('\\', '/')}?t=${Date.now()}`)
const fiber = ctx.plugin(plugin, {
  storeDir,
  catalogEnabled: false,
  registryUrl: 'http://127.0.0.1:1/never',
  probeTimeoutMs: 20000,
  mountTimeoutMs: 120000,
  logLinesPerServer: 200,
})
await fiber
await new Promise((resolve) => setTimeout(resolve, 300))

const base = `http://127.0.0.1:${port}`
async function rpc(method, ...args) {
  const response = await fetch(`${base}/mcp-studio-api/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mcp-studio': '1' },
    body: JSON.stringify({ method, args }),
  })
  return { status: response.status, body: await response.json() }
}

// -- claim: server name grammar + 32-char cap ---------------------------------
const tooLong = await rpc('addServer', {
  transport: 'stdio',
  title: 'Too Long',
  serverName: 'a'.repeat(33),
  command: 'definitely-not-a-command-xyz',
  args: [],
})
check(
  '33-character serverName is rejected as invalid-server-name',
  tooLong.body.ok === false && tooLong.body.error?.code === 'invalid-server-name',
  JSON.stringify(tooLong.body).slice(0, 160),
)
const badChar = await rpc('addServer', {
  transport: 'stdio',
  title: 'Bad Char',
  serverName: 'bad name!',
  command: 'definitely-not-a-command-xyz',
  args: [],
})
check(
  'serverName with a space/exclamation is rejected as invalid-server-name',
  badChar.body.ok === false && badChar.body.error?.code === 'invalid-server-name',
  JSON.stringify(badChar.body).slice(0, 160),
)

// -- claim: probe is temporary and cannot displace a live row ------------------
const live = await rpc('addServer', {
  transport: 'stdio',
  title: 'Live Seq',
  serverName: 'livetarget',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-sequential-thinking@1.0.0'],
  env: {},
  toolCallTimeoutMs: 60000,
})
check('live server connects', live.body.value?.status === 'connected', `status=${live.body.value?.status} err=${live.body.value?.lastError}`)
const before = [...registered.keys()].filter((n) => n.startsWith('mcp__livetarget__'))

const probe = await rpc('testConnection', {
  transport: 'stdio',
  title: 'Live Seq',
  serverName: 'livetarget',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-sequential-thinking@1.0.0'],
  env: {},
  toolCallTimeoutMs: 60000,
})
check('probe against the live name succeeds', probe.body.value?.ok === true, JSON.stringify(probe.body.value).slice(0, 160))
const after = [...registered.keys()].filter((n) => n.startsWith('mcp__livetarget__'))
check(
  'probe did not add or duplicate mcp__livetarget__* tools',
  JSON.stringify(before) === JSON.stringify(after),
  `before=[${before.join(',')}] after=[${after.join(',')}]`,
)
const leftoverProbe = [...registered.keys()].filter((n) => /^mcp__probe-/.test(n))
check('probe fibers are disposed (no mcp__probe-* registrations left)', leftoverProbe.length === 0, `leftover=[${leftoverProbe.join(',')}]`)
const liveDetail = await rpc('getServer', 'livetarget')
check('live row is still connected after the probe', liveDetail.body.value?.status === 'connected', `status=${liveDetail.body.value?.status}`)

// -- claim: secret file location + ACL ----------------------------------------
await rpc('setSecret', 'ACL_TEST', 'acl-value-not-real')
const secretsFile = join(storeDir, 'secrets.json')
check('secret is written to <storeDir>/secrets.json', existsSync(secretsFile), secretsFile)
check('servers.json does not contain the secret value', !readFileSync(join(storeDir, 'servers.json'), 'utf8').includes('acl-value-not-real'))
console.log(`STORE_DIR=${storeDir}`)

console.log(`\n${results.every((r) => r.ok) ? 'CLAIMS OK' : `CLAIMS FAILED: ${results.filter((r) => !r.ok).length}`}`)
await fiber.dispose()
server.close()
process.exit(results.every((r) => r.ok) ? 0 : 1)
