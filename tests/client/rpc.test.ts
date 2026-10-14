/**
 * The RPC seam: every facade method maps one-to-one onto the wire name, and
 * the HTTP transport owns the envelope, the guard header, and error mapping.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  RPC_HEADER,
  RPC_PATH,
  StudioRpcError,
  createHttpTransport,
  createStudioApi,
} from '../../src/client/rpc.js'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('http transport', () => {
  it('posts the wire name, the positional args, and the guard header', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true, value: [{ id: 'files' }] }))

    const value = await createHttpTransport({ fetch: fetchImpl as unknown as typeof fetch })('listServers', [])

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(RPC_PATH)
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json')
    expect((init.headers as Record<string, string>)[RPC_HEADER]).toBe('1')
    expect(init.body).toBe(JSON.stringify({ method: 'listServers', args: [] }))
    expect(value).toEqual([{ id: 'files' }])
  })

  it('accepts an explicit route and merges extra headers', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ok: true, value: null }))

    await createHttpTransport({
      fetch: fetchImpl as unknown as typeof fetch,
      url: '/custom',
      headers: { 'x-test': 'yes' },
    })('listServers', [])

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/custom')
    expect((init.headers as Record<string, string>)['x-test']).toBe('yes')
  })

  it('turns an ok:false envelope into a StudioRpcError carrying the code', async () => {
    const transport = createHttpTransport({
      fetch: (async () => jsonResponse({ ok: false, error: { message: 'not allowed', code: 'denied' } })) as unknown as typeof fetch,
    })

    await expect(transport('exportPatch', [])).rejects.toMatchObject({
      name: 'StudioRpcError',
      message: 'not allowed',
      code: 'denied',
    })
  })

  it('reports a non-2xx response with its status', async () => {
    const transport = createHttpTransport({
      fetch: (async () => new Response('boom', { status: 503 })) as unknown as typeof fetch,
    })

    await expect(transport('listServers', [])).rejects.toBeInstanceOf(StudioRpcError)
    await expect(transport('listServers', [])).rejects.toMatchObject({ status: 503 })
  })

  it('reports a non-JSON body instead of crashing', async () => {
    const transport = createHttpTransport({
      fetch: (async () => new Response('<html>', { status: 200 })) as unknown as typeof fetch,
    })

    await expect(transport('listServers', [])).rejects.toThrow(/non-JSON/)
  })

  it('reports a transport failure as an unreachable host', async () => {
    const transport = createHttpTransport({
      fetch: (async () => {
        throw new TypeError('fetch failed')
      }) as unknown as typeof fetch,
    })

    await expect(transport('listServers', [])).rejects.toThrow(/cannot reach the host/)
  })
})

describe('facade', () => {
  it('maps all eighteen methods one-to-one onto the wire name', async () => {
    const calls: Array<[string, unknown[]]> = []
    const api = createStudioApi({
      transport: (method, args) => {
        calls.push([method, args])
        return Promise.resolve(undefined)
      },
    })

    await api.listServers()
    await api.getServer('files')
    await api.addServer({ transport: 'stdio', title: 'Manual' })
    await api.updateServer('files', { title: 'Renamed' })
    await api.removeServer('files')
    await api.setEnabled('files', true)
    await api.restartServer('files')
    await api.testConnection({ transport: 'stdio', title: 'Manual' })
    await api.getLogs('files', 7)
    await api.catalog({ text: 'git' })
    await api.catalogCategories()
    await api.installFromCatalog('curated:git', { token: 'x' })
    await api.detectRuntimes()
    await api.listSecretNames()
    await api.setSecret('A', 'b')
    await api.deleteSecret('A')
    await api.resolveConfig({ transport: 'stdio', title: 'Manual' })
    await api.exportPatch()

    expect(calls.map(([method]) => method)).toEqual([
      'listServers',
      'getServer',
      'addServer',
      'updateServer',
      'removeServer',
      'setEnabled',
      'restartServer',
      'testConnection',
      'getLogs',
      'catalog',
      'catalogCategories',
      'installFromCatalog',
      'detectRuntimes',
      'listSecretNames',
      'setSecret',
      'deleteSecret',
      'resolveConfig',
      'exportPatch',
    ])
    expect(calls[8]).toEqual(['getLogs', ['files', 7]])
    expect(calls[11]).toEqual(['installFromCatalog', ['curated:git', { token: 'x' }]])
    expect(calls[14]).toEqual(['setSecret', ['A', 'b']])
    expect(calls[15]).toEqual(['deleteSecret', ['A']])
  })
})
