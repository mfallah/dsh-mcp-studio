/**
 * The host's local HTTP surface for the browser half.
 *
 * A third-party DSH client plugin cannot reliably reach its own host half over
 * the built-in Typert RPC: `@deepseek-ai/dsh-api-remotes` fixes the reachable
 * capability set from build-time imports, and forwarded events need an entry in
 * its own allowlist. `ctx.webServer` is the documented, plugin-facing
 * alternative — "feature plugins claim their routes" — so the panel talks to
 * one JSON endpoint here instead.
 *
 * Wire contract (frozen; the client's `rpc.ts` is the only consumer):
 *
 *   GET  /mcp-studio-api/health
 *        -> 200 { ok: true, name, version, servers }
 *
 *   POST /mcp-studio-api/rpc      header: x-mcp-studio: 1
 *        body     { method: "<McpStudioApi method>", args: [...] }
 *        -> 200 { ok: true,  value: <result> }
 *        -> 200 { ok: false, error: { message, code?, data? } }
 *
 * Failures the caller can fix (bad config, missing secret, unreachable server)
 * are answered as `ok: false` with status 200 so the browser always reads a
 * body. Only protocol-level mistakes — wrong path, wrong method, missing guard
 * header, cross-origin, oversized or malformed body — use a 4xx status.
 *
 * Security posture:
 * - The route lives under its own `/mcp-studio-api` prefix, outside `/api`, so
 *   it neither depends on nor weakens the harness's browser-trust fence.
 * - The server binds loopback only by default (`dsh-host-webserver` config).
 * - The `x-mcp-studio` header is mandatory. It is not a secret; its job is to
 *   force a CORS preflight, so a random web page cannot drive this API with a
 *   simple (non-preflighted) cross-origin POST.
 * - Requests carrying an `Origin` that is not this exact host are rejected, and
 *   `Sec-Fetch-Site` is rejected unless it is `same-origin` or `none`.
 *
 * @module @mfallah/dsh-mcp-studio/host/http
 */
import type { IncomingMessage, ServerResponse } from 'node:http'

/** Path prefix this plugin owns. Never collides with `/api` or `/plugins`. */
export const API_PREFIX = '/mcp-studio-api'

/**
 * The slice of `ctx.webServer` this module uses.
 *
 * Structural rather than an import of `@deepseek-ai/dsh-host-webserver`, so the
 * plugin does not need that package's types to compile and still works when the
 * route is registered by a compatible server.
 */
export interface WebServerLike {
  register(route: {
    kind: 'exact' | 'prefix'
    path: string
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
  }): () => void
}

/** Header the client must send. Forces a preflight for cross-origin callers. */
export const CLIENT_HEADER = 'x-mcp-studio'

/** Largest accepted request body. Config payloads are tiny; 1 MiB is generous. */
const MAX_BODY_BYTES = 1024 * 1024

/** RPC handler signature: one method name plus positional arguments. */
export type RpcDispatch = (method: string, args: unknown[]) => Promise<unknown>

/** Facts the health endpoint reports, so an installer can verify the plugin. */
export interface ApiFacts {
  name: string
  version: string
  serverCount: () => number
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('content-length', Buffer.byteLength(body))
  res.end(body)
}

function fail(res: ServerResponse, status: number, message: string, code?: string): void {
  sendJson(res, status, { ok: false, error: code === undefined ? { message } : { message, code } })
}

/** Whether an `Origin` header is this same local host. */
function originAllowed(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  if (origin === undefined || origin === '') return true
  let hostname: string
  let host: string
  try {
    const parsed = new URL(origin)
    hostname = parsed.hostname
    host = parsed.host
  } catch {
    return false
  }
  const loopback =
    hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1' || hostname === '[::1]'
  if (!loopback) return false
  const ownHost = req.headers.host
  return ownHost === undefined || host === ownHost
}

/** Fetch-metadata fence: allow same-origin and direct navigation only. */
function fetchSiteAllowed(req: IncomingMessage): boolean {
  const site = req.headers['sec-fetch-site']
  if (site === undefined) return true
  const value = Array.isArray(site) ? site[0] : site
  return value === 'same-origin' || value === 'none'
}

async function readBody(req: IncomingMessage): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error(`request body exceeds ${MAX_BODY_BYTES} bytes`))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/**
 * Register the MCP Studio HTTP surface on the harness web server.
 * @param webServer - the route registry (`ctx.webServer`).
 * @param dispatch - runs one `McpStudioApi` method; throws are reported as `ok: false`.
 * @param facts - identity and liveness data for the health endpoint.
 * @returns the route disposer.
 */
export function registerApi(webServer: WebServerLike, dispatch: RpcDispatch, facts: ApiFacts): () => void {
  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    let pathname: string
    try {
      pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname
    } catch {
      fail(res, 400, 'malformed request URL')
      return
    }

    if (pathname === `${API_PREFIX}/health`) {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        fail(res, 405, 'health accepts GET only')
        return
      }
      sendJson(res, 200, {
        ok: true,
        name: facts.name,
        version: facts.version,
        servers: facts.serverCount(),
      })
      return
    }

    if (pathname !== `${API_PREFIX}/rpc`) {
      fail(res, 404, `unknown endpoint ${pathname}`)
      return
    }
    if (req.method !== 'POST') {
      fail(res, 405, 'rpc accepts POST only')
      return
    }

    const guard = req.headers[CLIENT_HEADER]
    const guardValue = Array.isArray(guard) ? guard[0] : guard
    if (guardValue !== '1') {
      fail(res, 403, `missing ${CLIENT_HEADER}: 1 header`, 'guard-missing')
      return
    }
    if (!originAllowed(req)) {
      fail(res, 403, 'cross-origin request refused', 'origin-refused')
      return
    }
    if (!fetchSiteAllowed(req)) {
      fail(res, 403, 'cross-site request refused', 'fetch-site-refused')
      return
    }

    let raw: string
    try {
      raw = await readBody(req)
    } catch (error) {
      fail(res, 413, error instanceof Error ? error.message : 'unreadable body', 'body-too-large')
      return
    }

    let parsed: unknown
    try {
      parsed = raw.length === 0 ? {} : JSON.parse(raw)
    } catch {
      fail(res, 400, 'request body is not valid JSON', 'body-invalid')
      return
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      fail(res, 400, 'request body must be a JSON object', 'body-invalid')
      return
    }

    const { method, args } = parsed as { method?: unknown; args?: unknown }
    if (typeof method !== 'string' || method.length === 0) {
      fail(res, 400, 'request body needs a string "method"', 'method-invalid')
      return
    }
    const callArgs = args === undefined ? [] : args
    if (!Array.isArray(callArgs)) {
      fail(res, 400, 'request body "args" must be an array when present', 'args-invalid')
      return
    }

    try {
      const value = await dispatch(method, callArgs)
      sendJson(res, 200, { ok: true, value: value === undefined ? null : value })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const code =
        typeof (error as { code?: unknown })?.code === 'string'
          ? ((error as { code: string }).code)
          : undefined
      sendJson(res, 200, { ok: false, error: code === undefined ? { message } : { message, code } })
    }
  }

  return webServer.register({ kind: 'prefix', path: API_PREFIX, handler })
}
