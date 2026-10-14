/**
 * The single seam between the MCP Studio UI and the host half.
 *
 * The host exposes exactly one route — `POST /mcp-studio-api/rpc` — carrying
 * `{ method, args }`; this module is the only place that knows that wire
 * format. Every call the panel makes goes through the `McpStudioApi`-shaped
 * facade returned by {@link createStudioApi}, so tests inject a fake by
 * passing a `transport` and any change to the RPC convention touches this file
 * alone. Components import `McpStudioApi` (types only) and never call `fetch`.
 *
 * @module @mfallah/dsh-mcp-studio/client/rpc
 */
import type { McpStudioApi } from '../shared/contract.js'

/** Route the host half registers on `ctx.webServer`. */
export const RPC_PATH = '/mcp-studio-api/rpc'

/** Header the host uses to reject drive-by requests from other origins. */
export const RPC_HEADER = 'x-mcp-studio'

/** One wire call: method name plus positional arguments. */
export type RpcTransport = (method: string, args: unknown[]) => Promise<unknown>

/** Failure from the host route, carrying the machine-readable code when present. */
export class StudioRpcError extends Error {
  /** Machine-readable class from the host envelope, when it supplied one. */
  readonly code?: string
  /** HTTP status of the failing response, when the failure was transport-level. */
  readonly status?: number

  constructor(message: string, options: { code?: string; status?: number } = {}) {
    super(message)
    this.name = 'StudioRpcError'
    if (options.code !== undefined) this.code = options.code
    if (options.status !== undefined) this.status = options.status
  }
}

/** Options accepted by {@link createStudioApi}. */
export interface StudioApiOptions {
  /** Route override; defaults to {@link RPC_PATH}. */
  url?: string
  /** Fetch implementation; defaults to the page's global fetch. */
  fetch?: typeof globalThis.fetch
  /** Extra headers merged over the plugin's own. */
  headers?: Record<string, string>
  /** Pre-built transport, for tests. When present the fetch path is not used. */
  transport?: RpcTransport
}

interface RpcSuccess {
  ok: true
  value: unknown
}

interface RpcFailure {
  ok: false
  error?: { message?: string; code?: string }
}

function isFailure(payload: unknown): payload is RpcFailure {
  return !!payload && typeof payload === 'object' && (payload as { ok?: unknown }).ok === false
}

/**
 * Build the HTTP transport the facade speaks over.
 *
 * Sends `{ method, args }`, requires a `2xx` with a JSON `{ ok }` envelope,
 * and turns `{ ok: false }` into a {@link StudioRpcError} carrying `code`.
 *
 * @param options - route, fetch implementation, and extra headers.
 * @returns a transport function usable by {@link createStudioApi}.
 */
export function createHttpTransport(options: StudioApiOptions = {}): RpcTransport {
  const url = options.url ?? RPC_PATH
  const fetchImpl = options.fetch ?? globalThis.fetch
  return async (method, args) => {
    if (typeof fetchImpl !== 'function') {
      throw new StudioRpcError('mcp-studio: this browser exposes no fetch; the panel cannot reach the host')
    }
    let response: Response
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [RPC_HEADER]: '1',
          ...(options.headers ?? {}),
        },
        body: JSON.stringify({ method, args }),
        credentials: 'same-origin',
      })
    } catch (error) {
      throw new StudioRpcError(
        `mcp-studio: cannot reach the host route (${error instanceof Error ? error.message : String(error)})`,
      )
    }
    if (!response.ok) {
      throw new StudioRpcError(`mcp-studio: host route answered HTTP ${response.status}`, {
        status: response.status,
      })
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new StudioRpcError('mcp-studio: host route answered with a non-JSON body', {
        status: response.status,
      })
    }
    if (isFailure(payload)) {
      throw new StudioRpcError(payload.error?.message ?? 'mcp-studio: the host rejected the call', {
        code: payload.error?.code,
      })
    }
    return (payload as RpcSuccess).value
  }
}

function invoke<T>(transport: RpcTransport, method: keyof McpStudioApi, ...args: unknown[]): Promise<T> {
  return transport(method, args) as Promise<T>
}

/**
 * Build the typed facade the UI consumes.
 *
 * Method names map one-to-one onto the wire, so the host half can dispatch on
 * `method` directly.
 *
 * @param options - transport override plus HTTP options.
 * @returns the `McpStudioApi` facade; every method rejects with
 *   {@link StudioRpcError} when the route is unavailable or the call fails.
 */
export function createStudioApi(options: StudioApiOptions = {}): McpStudioApi {
  const transport = options.transport ?? createHttpTransport(options)
  return {
    listServers: () => invoke(transport, 'listServers'),
    getServer: (id) => invoke(transport, 'getServer', id),
    addServer: (draft) => invoke(transport, 'addServer', draft),
    updateServer: (id, patch) => invoke(transport, 'updateServer', id, patch),
    removeServer: (id) => invoke(transport, 'removeServer', id),
    setEnabled: (id, enabled) => invoke(transport, 'setEnabled', id, enabled),
    restartServer: (id) => invoke(transport, 'restartServer', id),
    testConnection: (draft) => invoke(transport, 'testConnection', draft),
    getLogs: (id, sinceSeq) => invoke(transport, 'getLogs', id, sinceSeq),
    catalog: (query) => invoke(transport, 'catalog', query),
    catalogCategories: () => invoke(transport, 'catalogCategories'),
    installFromCatalog: (catalogId, values) => invoke(transport, 'installFromCatalog', catalogId, values),
    detectRuntimes: () => invoke(transport, 'detectRuntimes'),
    listSecretNames: () => invoke(transport, 'listSecretNames'),
    setSecret: (name, value) => invoke(transport, 'setSecret', name, value),
    deleteSecret: (name) => invoke(transport, 'deleteSecret', name),
    resolveConfig: (draft) => invoke(transport, 'resolveConfig', draft),
    exportPatch: () => invoke(transport, 'exportPatch'),
  }
}

/** Human-readable message for anything a rejected promise can carry. */
export function errorMessage(error: unknown): string {
  if (error instanceof StudioRpcError) return error.message
  if (error instanceof Error) return error.message
  if (typeof error === 'string' && error.length > 0) return error
  return 'mcp-studio: the host call failed for an unknown reason'
}
