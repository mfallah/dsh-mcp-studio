/**
 * Independent adversarial harness for the MCP Studio host API.
 *
 * Written by the verifier, NOT the plugin authors. It boots the built host
 * bundle (lib/index.js) in an isolated Cordis runtime with a fake `tools`
 * registry and a real node:http server standing in for `ctx.webServer`, then
 * drives the real HTTP surface maliciously.
 *
 * Run:  node tests/e2e/adversarial-host-api.mjs
 *
 * Nothing in this file is imported by product code.
 */
import { Context } from '@deepseek-ai/cordis'
import http from 'node:http'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const REPO = join(HERE, '..', '..')
const BUNDLE = join(REPO, 'lib', 'index.js')

const results = []
const failures = []
function check(name, condition, detail = '') {
  const ok = Boolean(condition)
  results.push({ ok, name, detail })
  if (!ok) failures.push(name)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

/** Boot the built plugin in isolation. */
async function boot(storeDir, options = {}) {
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

  const plugin = await import(`${pathToFileUrl(BUNDLE)}?t=${Date.now()}`)
  const fiber = ctx.plugin(plugin, {
    storeDir,
    catalogEnabled: false,
    registryUrl: 'http://127.0.0.1:1/never',
    probeTimeoutMs: options.probeTimeoutMs ?? 20000,
    mountTimeoutMs: options.mountTimeoutMs ?? 120000,
    logLinesPerServer: 200,
  })
  await fiber
  await new Promise((resolve) => setTimeout(resolve, 500))

  const base = `http://127.0.0.1:${port}`
  async function rpc(method, ...args) {
    const response = await fetch(`${base}/mcp-studio-api/rpc`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mcp-studio': '1' },
      body: JSON.stringify({ method, args }),
    })
    return { status: response.status, body: await response.json() }
  }
  return {
    ctx,
    fiber,
    server,
    routes,
    registered,
    base,
    port,
    rpc,
    async dispose() {
      await fiber.dispose()
      server.close()
    },
  }
}

function pathToFileUrl(p) {
  return `file:///${p.replaceAll('\\', '/')}`
}

/** Every file under `dir`, recursively, as absolute paths. */
function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

const started = Date.now()
console.log(`bundle: ${BUNDLE}`)
console.log(`bundle sha256: ${sha256(BUNDLE)}`)
console.log(`node: ${process.version}`)

// ===========================================================================
// A. Allowlist: prototype / internal methods must never be reachable.
// ===========================================================================
{
  const dir = mkdtempSync(join(tmpdir(), 'mcp-studio-adv-a-'))
  const h = await boot(dir)
  for (const method of ['constructor', '__proto__', 'referencesTo', 'hasOwnProperty', 'toString', 'valueOf', 'apply']) {
    const out = await h.rpc(method)
    check(
      `allowlist rejects method "${method}"`,
      out.body.ok === false && out.body.error?.code === 'unknown-method',
      `status=${out.status} body=${JSON.stringify(out.body).slice(0, 160)}`,
    )
  }
  // Args that are not an array, missing method, malformed JSON.
  const noArgs = await fetch(`${h.base}/mcp-studio-api/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mcp-studio': '1' },
    body: JSON.stringify({ method: 'listServers', args: {} }),
  })
  check('non-array args refused with 400', noArgs.status === 400, `status=${noArgs.status}`)
  const badJson = await fetch(`${h.base}/mcp-studio-api/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mcp-studio': '1' },
    body: '{oops',
  })
  check('malformed JSON refused with 400', badJson.status === 400, `status=${badJson.status}`)
  const noMethod = await fetch(`${h.base}/mcp-studio-api/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mcp-studio': '1' },
    body: JSON.stringify({ args: [] }),
  })
  check('missing method refused with 400', noMethod.status === 400, `status=${noMethod.status}`)

  // id traversal
  const traversal = await h.rpc('getServer', '../../../etc/passwd')
  check(
    'getServer("../../../etc/passwd") fails with invalid-id',
    traversal.body.ok === false && traversal.body.error?.code === 'invalid-id',
    JSON.stringify(traversal.body).slice(0, 200),
  )
  const traversal2 = await h.rpc('getLogs', '..\\..\\windows\\win.ini', 0)
  check(
    'getLogs("..\\\\..\\\\windows\\\\win.ini") fails with invalid-id',
    traversal2.body.ok === false && traversal2.body.error?.code === 'invalid-id',
    JSON.stringify(traversal2.body).slice(0, 200),
  )
  await h.dispose()
  rmSync(dir, { recursive: true, force: true })
}

// ===========================================================================
// B. Guard headers / origin.
// ===========================================================================
{
  const dir = mkdtempSync(join(tmpdir(), 'mcp-studio-adv-b-'))
  const h = await boot(dir)
  const body = JSON.stringify({ method: 'listServers', args: [] })

  const noGuard = await fetch(`${h.base}/mcp-studio-api/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
  check('missing x-mcp-studio header => 403', noGuard.status === 403, `status=${noGuard.status}`)

  const evilOrigin = await fetch(`${h.base}/mcp-studio-api/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mcp-studio': '1', origin: 'http://evil.example' },
    body,
  })
  check('Origin http://evil.example => 403', evilOrigin.status === 403, `status=${evilOrigin.status}`)

  const crossSite = await fetch(`${h.base}/mcp-studio-api/rpc`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-mcp-studio': '1',
      'sec-fetch-site': 'cross-site',
    },
    body,
  })
  check('Sec-Fetch-Site: cross-site => 403', crossSite.status === 403, `status=${crossSite.status}`)

  const wrongGuard = await fetch(`${h.base}/mcp-studio-api/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mcp-studio': '0' },
    body,
  })
  check('x-mcp-studio: 0 => 403', wrongGuard.status === 403, `status=${wrongGuard.status}`)
  await h.dispose()
  rmSync(dir, { recursive: true, force: true })
}

// ===========================================================================
// C. Oversized body (2 MiB) must be refused, not buffered to death.
// ===========================================================================
{
  const dir = mkdtempSync(join(tmpdir(), 'mcp-studio-adv-c-'))
  const h = await boot(dir)
  const big = 'x'.repeat(2 * 1024 * 1024)
  let outcome
  try {
    const response = await fetch(`${h.base}/mcp-studio-api/rpc`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-mcp-studio': '1' },
      body: JSON.stringify({ method: 'listServers', args: [big] }),
    })
    outcome = { status: response.status, text: (await response.text()).slice(0, 200) }
  } catch (error) {
    outcome = { error: `${error?.cause?.code ?? error?.code ?? error?.name}: ${error?.message}` }
  }
  // Raw socket view: does a 413 response ever come back, or is the socket reset?
  const raw = await new Promise((resolve) => {
    const payload = Buffer.from(JSON.stringify({ method: 'listServers', args: [big] }), 'utf8')
    const req = http.request(
      {
        host: '127.0.0.1',
        port: h.port,
        method: 'POST',
        path: '/mcp-studio-api/rpc',
        headers: {
          'content-type': 'application/json',
          'x-mcp-studio': '1',
          'content-length': String(payload.length),
        },
      },
      (res) => {
        let text = ''
        res.on('data', (chunk) => {
          text += chunk
        })
        res.on('end', () => resolve({ event: 'response', status: res.statusCode, text: text.slice(0, 200) }))
      },
    )
    req.on('error', (error) => resolve({ event: 'error', code: error.code, message: error.message }))
    req.end(payload)
  })
  console.log(`   oversized raw-socket outcome: ${JSON.stringify(raw)}`)
  // "Refused" means: not 200, and the process is still alive and serving.
  const stillAlive = await h.rpc('listServers')
  check(
    '2 MiB body is refused (no 200)',
    outcome.status === undefined ? true : outcome.status !== 200,
    JSON.stringify(outcome).slice(0, 220),
  )
  check(
    '2 MiB body gets the documented 413 (not a socket reset)',
    outcome.status === 413,
    JSON.stringify(outcome).slice(0, 220),
  )
  check('API still serves after the oversized request', stillAlive.body.ok === true, JSON.stringify(stillAlive.body).slice(0, 120))
  await h.dispose()
  rmSync(dir, { recursive: true, force: true })
}

// ===========================================================================
// D. Missing secret must never silently connect.
// ===========================================================================
{
  const dir = mkdtempSync(join(tmpdir(), 'mcp-studio-adv-d-'))
  const h = await boot(dir)
  const added = await h.rpc('addServer', {
    transport: 'stdio',
    title: 'Missing Secret',
    serverName: 'missingsecret',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory@2026.7.4'],
    env: { A: '${secret:DOES_NOT_EXIST}' },
  })
  const view = added.body.value
  const connected = view?.status === 'connected'
  const errored = view?.status === 'error'
  const rejectedAtRpc = added.body.ok === false
  check(
    'server whose secret is missing is NOT connected',
    !connected,
    `ok=${added.body.ok} status=${view?.status} lastError=${view?.lastError}`,
  )
  check(
    'missing secret is reported as an error',
    rejectedAtRpc || errored,
    `rpc_ok=${added.body.ok} status=${view?.status} lastError=${view?.lastError}`,
  )
  check(
    'missing secret produced no tools',
    (view?.toolCount ?? 0) === 0 && ![...h.registered.keys()].some((n) => n.startsWith('mcp__missingsecret__')),
    `toolCount=${view?.toolCount} registered=${[...h.registered.keys()].join(',')}`,
  )
  const logs = await h.rpc('getLogs', 'missingsecret', 0)
  check(
    'missing-secret failure is visible in getLogs',
    logs.body.ok === true && logs.body.value.entries.some((e) => /cannot connect|missing/i.test(e.message)),
    JSON.stringify(logs.body.value?.entries?.map((e) => e.message)).slice(0, 200),
  )
  await h.dispose()
  rmSync(dir, { recursive: true, force: true })
}

// ===========================================================================
// E. Duplicate serverName.
// ===========================================================================
{
  const dir = mkdtempSync(join(tmpdir(), 'mcp-studio-adv-e-'))
  const h = await boot(dir)
  const draft = {
    transport: 'stdio',
    title: 'Dup One',
    serverName: 'dupname',
    command: 'definitely-not-a-command-xyz',
    args: [],
  }
  const first = await h.rpc('addServer', draft)
  const second = await h.rpc('addServer', { ...draft, title: 'Dup Two' })
  check(
    'second addServer with same serverName fails with duplicate-server-name',
    second.body.ok === false && second.body.error?.code === 'duplicate-server-name',
    `first_ok=${first.body.ok} second=${JSON.stringify(second.body).slice(0, 200)}`,
  )
  const list = await h.rpc('listServers')
  check(
    'duplicate add persisted exactly one row',
    list.body.value?.length === 1,
    `count=${list.body.value?.length}`,
  )
  await h.dispose()
  rmSync(dir, { recursive: true, force: true })
}

// ===========================================================================
// F. Secret non-leakage across an install + real connect cycle.
// ===========================================================================
const SENTINEL = 'SENTINEL-9f3a7c1d-DO-NOT-LEAK'
{
  const dir = mkdtempSync(join(tmpdir(), 'mcp-studio-adv-f-'))
  const h = await boot(dir)
  const responses = []
  const rpcCapture = async (...args) => {
    const out = await h.rpc(...args)
    responses.push(JSON.stringify(out))
    return out
  }

  await rpcCapture('setSecret', 'DEMO_TOKEN', SENTINEL)
  const names = await rpcCapture('listSecretNames')
  check('setSecret stores the name (not the value)', names.body.value?.includes('DEMO_TOKEN') === true, JSON.stringify(names.body))

  // Real stdio connect carrying the secret as an env var.
  const stdio = await rpcCapture('addServer', {
    transport: 'stdio',
    title: 'Leak Probe stdio',
    serverName: 'leakprobe',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory@2026.7.4'],
    env: {
      MEMORY_FILE_PATH: join(dir, 'memory.jsonl'),
      DEMO_TOKEN: '${secret:DEMO_TOKEN}',
    },
  })
  check('stdio server using a secret connects', stdio.body.value?.status === 'connected', `status=${stdio.body.value?.status} err=${stdio.body.value?.lastError}`)

  // HTTP server with the secret in a header, pointed at a dead port to force an
  // error path that renders the failure to the user.
  const httpServer = await rpcCapture('addServer', {
    transport: 'streamable-http',
    title: 'Leak Probe http',
    serverName: 'leakhttp',
    url: 'http://127.0.0.1:9/mcp',
    headers: { Authorization: 'Bearer ${secret:DEMO_TOKEN}' },
  })
  check('http server using a secret is not silently connected', httpServer.body.value?.status !== 'connected', `status=${httpServer.body.value?.status}`)

  const detail = await rpcCapture('getServer', 'leakprobe')
  const logs = await rpcCapture('getLogs', 'leakprobe', 0)
  const httpLogs = await rpcCapture('getLogs', 'leakhttp', 0)
  const all = await rpcCapture('listServers')
  const patch = await rpcCapture('exportPatch')
  const resolved = await rpcCapture('resolveConfig', {
    transport: 'stdio',
    title: 'r',
    command: 'npx',
    args: [],
    env: { DEMO_TOKEN: '${secret:DEMO_TOKEN}' },
  })

  const responsesWithSecret = responses.filter((text) => text.includes(SENTINEL))
  check('no RPC response body contains the secret value', responsesWithSecret.length === 0, `hits=${responsesWithSecret.length}`)

  // Files after the cycle.
  const files = walk(dir)
  const fileHits = []
  for (const file of files) {
    const raw = readFileSync(file)
    if (raw.includes(SENTINEL)) fileHits.push(relative(dir, file))
  }
  check(
    'the ONLY store file containing the secret value is secrets.json',
    fileHits.length > 0 && fileHits.every((f) => f === 'secrets.json'),
    `files_with_value=[${fileHits.join(', ')}] all_files=[${files.map((f) => relative(dir, f)).join(', ')}]`,
  )
  check(
    'servers.json does not contain the secret value',
    !fileHits.includes('servers.json'),
    `servers_files_with_value=[${fileHits.filter((f) => f.startsWith('servers')).join(', ')}]`,
  )

  const serversJson = readFileSync(join(dir, 'servers.json'), 'utf8')
  check('servers.json holds the placeholder, not the value', serversJson.includes('${secret:DEMO_TOKEN}') && !serversJson.includes(SENTINEL))
  const secretsJson = existsSync(join(dir, 'secrets.json')) ? readFileSync(join(dir, 'secrets.json'), 'utf8') : ''
  check('secret value IS in secrets.json (that is where it belongs)', secretsJson.includes(SENTINEL))

  const logText = JSON.stringify(logs.body) + JSON.stringify(httpLogs.body) + JSON.stringify(detail.body)
  check('no log entry or detail payload contains the secret value', !logText.includes(SENTINEL))

  check('secret-in-use deletion is refused', (await rpcCapture('deleteSecret', 'DEMO_TOKEN')).body.error?.code === 'secret-in-use')

  console.log(`   store files after cycle: ${files.map((f) => relative(dir, f)).join(', ')}`)
  console.log(`   stdio status=${stdio.body.value?.status} tools=${stdio.body.value?.toolCount} registered=[${[...h.registered.keys()].join(',')}]`)
  await h.dispose()
  rmSync(dir, { recursive: true, force: true })
}

// ===========================================================================
// G. Corruption resilience: invalid JSON in servers.json.
// ===========================================================================
{
  const dir = mkdtempSync(join(tmpdir(), 'mcp-studio-adv-g-'))
  writeFileSync(join(dir, 'servers.json'), '{ this is not json at all', 'utf8')
  let booted = false
  let h
  try {
    h = await boot(dir)
    booted = true
  } catch (error) {
    check('plugin boots with a corrupt servers.json', false, `threw: ${error?.message}`)
  }
  if (booted) {
    check('plugin boots with a corrupt servers.json', true)
    const list = await h.rpc('listServers')
    check('API still serves after corruption', list.body.ok === true && list.body.value.length === 0, JSON.stringify(list.body).slice(0, 160))
    const quarantined = readdirSync(dir).filter((n) => n.startsWith('servers.corrupt-'))
    check('corrupt file is quarantined, not deleted', quarantined.length === 1, `dir=[${readdirSync(dir).join(', ')}]`)
    if (quarantined.length === 1) {
      check('quarantined file keeps the original bytes', readFileSync(join(dir, quarantined[0]), 'utf8') === '{ this is not json at all')
    }
    // Add then list, proving the store is writable again.
    const added = await h.rpc('addServer', {
      transport: 'stdio',
      title: 'After Corruption',
      serverName: 'aftercorrupt',
      command: 'definitely-not-a-command-xyz',
      args: [],
    })
    check('store is writable after quarantine', added.body.ok === true, JSON.stringify(added.body).slice(0, 160))
    await h.dispose()
  }
  rmSync(dir, { recursive: true, force: true })
}

// ===========================================================================
// H. Second independent end-to-end path: a DIFFERENT real MCP server.
// ===========================================================================
{
  const dir = mkdtempSync(join(tmpdir(), 'mcp-studio-adv-h-'))
  const h = await boot(dir)
  const added = await h.rpc('addServer', {
    transport: 'stdio',
    title: 'Sequential Thinking',
    serverName: 'seqthink',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking@1.0.0'],
    env: {},
    toolCallTimeoutMs: 60000,
  })
  const view = added.body.value
  check(
    'second, different MCP server connects',
    view?.status === 'connected',
    `ok=${added.body.ok} status=${view?.status} lastError=${view?.lastError}`,
  )
  const namespaces = [...h.registered.keys()]
  check(
    'its tools register under mcp__seqthink__*',
    namespaces.some((n) => n.startsWith('mcp__seqthink__')),
    `registered=[${namespaces.join(', ')}]`,
  )
  console.log(`   tools seen: [${namespaces.join(', ')}]`)
  const removed = await h.rpc('removeServer', 'seqthink')
  check('the second server removes cleanly', removed.body.ok === true, JSON.stringify(removed.body).slice(0, 160))
  check('its tools are unregistered after removal', ![...h.registered.keys()].some((n) => n.startsWith('mcp__seqthink__')))
  await h.dispose()
  rmSync(dir, { recursive: true, force: true })
}

console.log(`\n${failures.length === 0 ? 'ADVERSARIAL OK' : `ADVERSARIAL FAILED: ${failures.length} of ${results.length}`}`)
console.log(`elapsed ${Date.now() - started}ms`)
console.log(JSON.stringify({ pass: results.filter((r) => r.ok).length, fail: failures.length, failures }))
process.exit(failures.length === 0 ? 0 : 1)
