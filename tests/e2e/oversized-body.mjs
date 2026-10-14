/**
 * Minimal reproduction: a request body over MAX_BODY_BYTES.
 *
 * http.ts readBody() calls `req.destroy()` after rejecting, which destroys the
 * socket before the 413 response can be written. This script shows exactly what
 * a client observes, at the raw socket level, with no fetch wrapper.
 *
 * Run:  node tests/e2e/oversized-body.mjs
 */
import { Context } from '@deepseek-ai/cordis'
import http from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')

const ctx = new Context()
ctx.provide('tools', { register: () => () => {}, schemas: () => [] })
const routes = []
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname
  const route = routes.find((r) => pathname === r.path || pathname.startsWith(`${r.path}/`))
  if (!route) {
    res.statusCode = 404
    res.end('no route')
    return
  }
  Promise.resolve(route.handler(req, res)).catch(() => {
    res.statusCode = 500
    res.end('handler failed')
  })
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
ctx.provide('webServer', {
  register(route) {
    routes.push(route)
    return () => {}
  },
  get port() {
    return port
  },
})

const storeDir = mkdtempSync(join(tmpdir(), 'mcp-studio-bigbody-'))
const plugin = await import(`file:///${join(REPO, 'lib', 'index.js').replaceAll('\\', '/')}?t=${Date.now()}`)
const fiber = ctx.plugin(plugin, {
  storeDir,
  catalogEnabled: false,
  registryUrl: 'http://127.0.0.1:1/never',
  probeTimeoutMs: 20000,
  mountTimeoutMs: 120000,
  logLinesPerServer: 50,
})
await fiber
await new Promise((resolve) => setTimeout(resolve, 300))

async function post(body, label) {
  const payload = Buffer.from(JSON.stringify(body), 'utf8')
  const outcome = await new Promise((resolve) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
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
        res.on('end', () => resolve({ event: 'response', status: res.statusCode, body: text.slice(0, 200) }))
      },
    )
    req.on('error', (error) => resolve({ event: 'error', code: error.code, message: error.message }))
    req.end(payload)
  })
  console.log(`${label}: ${JSON.stringify(outcome)}`)
  return outcome
}

await post({ method: 'listServers', args: [] }, 'small body (1 KiB)')
await post({ method: 'listServers', args: ['x'.repeat(2 * 1024 * 1024)] }, 'oversized body (2 MiB, under the drain cap)')
await post({ method: 'listServers', args: [] }, 'small body after the oversized one')
// Over the hard drain cap (8x the 1 MiB limit) the socket is dropped instead of drained.
await post({ method: 'listServers', args: ['x'.repeat(16 * 1024 * 1024)] }, 'hostile body (16 MiB, over the drain cap)')
await post({ method: 'listServers', args: [] }, 'small body after the hostile one')
console.log(`expected by docs/http.ts: 413 with a JSON error envelope under the drain cap;`)
console.log(`no 200 and a dropped socket over it, with the server still serving afterwards`)

await fiber.dispose()
server.close()
rmSync(storeDir, { recursive: true, force: true })
