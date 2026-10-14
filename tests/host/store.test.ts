import { afterEach, describe, expect, it } from 'vitest'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  parseServersFile,
  serializeServersFile,
  ServerStore,
  StoreError,
  validateServerConfig,
} from '../../src/host/store.js'
import { STORE_FORMAT_VERSION, type HttpServer, type StdioServer } from '../../src/shared/contract.js'

const dirs: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mcp-studio-store-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function stdio(overrides: Partial<StdioServer> = {}): StdioServer {
  return {
    id: 'alpha',
    serverName: 'alpha',
    title: 'Alpha',
    transport: 'stdio',
    enabled: true,
    source: 'custom',
    failOnStartupError: false,
    toolCallTimeoutMs: 60_000,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    command: 'npx',
    args: ['-y', 'some-package'],
    env: {},
    ...overrides,
  }
}

function http(overrides: Partial<HttpServer> = {}): HttpServer {
  return {
    id: 'beta',
    serverName: 'beta',
    title: 'Beta',
    transport: 'streamable-http',
    enabled: true,
    source: 'curated',
    failOnStartupError: false,
    toolCallTimeoutMs: 60_000,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    url: 'https://example.com/mcp',
    headers: {},
    ...overrides,
  }
}

describe('ServerStore.init', () => {
  it('creates the store directory and starts empty when there is no file', async () => {
    const dir = join(tempDir(), 'nested', 'mcp-studio')
    const store = new ServerStore({ dir })
    const init = await store.init()

    expect(init.warnings).toEqual([])
    expect(existsSync(dir)).toBe(true)
    expect(store.list()).toEqual([])
  })

  it('is idempotent', async () => {
    const store = new ServerStore({ dir: tempDir() })
    await store.init()
    const second = await store.init()
    expect(second.warnings).toEqual([])
    expect(store.list()).toEqual([])
  })
})

describe('ServerStore round trip', () => {
  it('persists and reloads a server through a new instance', async () => {
    const dir = tempDir()
    const store = new ServerStore({ dir })
    await store.init()
    await store.upsert(stdio({ env: { API_KEY: '${secret:apiKey}' } }))

    const reopened = new ServerStore({ dir })
    await reopened.init()

    expect(reopened.list()).toEqual([stdio({ env: { API_KEY: '${secret:apiKey}' } })])
  })

  it('writes the versioned envelope', async () => {
    const dir = tempDir()
    const store = new ServerStore({ dir })
    await store.init()
    await store.upsert(stdio())

    const raw = JSON.parse(readFileSync(join(dir, 'servers.json'), 'utf8'))
    expect(raw).toEqual({
      version: STORE_FORMAT_VERSION,
      servers: [stdio()],
    })
  })

  it('leaves no temporary files behind', async () => {
    const dir = tempDir()
    const store = new ServerStore({ dir })
    await store.init()
    await store.upsert(stdio())
    await store.upsert(stdio({ title: 'Alpha 2' }))

    const leftovers = readdirSync(dir).filter((name) => name.endsWith('.tmp'))
    expect(leftovers).toEqual([])
  })

  it('returns copies, so callers cannot mutate the store', async () => {
    const store = new ServerStore({ dir: tempDir() })
    await store.init()
    await store.upsert(stdio())

    const list = store.list()
    list[0]!.title = 'mutated'
    const got = store.get('alpha')
    got!.title = 'also mutated'

    expect(store.get('alpha')!.title).toBe('Alpha')
  })

  it('replaces on upsert with the same id and keeps insertion order', async () => {
    const store = new ServerStore({ dir: tempDir() })
    await store.init()
    await store.upsert(stdio({ id: 'alpha', serverName: 'alpha' }))
    await store.upsert(stdio({ id: 'beta', serverName: 'beta', title: 'Beta' }))
    await store.upsert(stdio({ id: 'alpha', serverName: 'alpha', title: 'Alpha v2' }))

    expect(store.list().map((entry) => `${entry.id}:${entry.title}`)).toEqual([
      'alpha:Alpha v2',
      'beta:Beta',
    ])
  })

  it('removes by id and ignores an unknown id', async () => {
    const store = new ServerStore({ dir: tempDir() })
    await store.init()
    await store.upsert(stdio())
    await store.remove('alpha')
    await store.remove('missing')
    expect(store.list()).toEqual([])
  })

  it('looks up by id and by serverName', async () => {
    const store = new ServerStore({ dir: tempDir() })
    await store.init()
    await store.upsert(stdio({ id: 'one', serverName: 'name-one' }))

    expect(store.get('one')?.id).toBe('one')
    expect(store.get('nope')).toBeUndefined()
    expect(store.findByName('name-one')?.id).toBe('one')
    expect(store.findByName('nope')).toBeUndefined()
  })

  it('re-reads from disk after reload()', async () => {
    const dir = tempDir()
    const store = new ServerStore({ dir })
    await store.init()
    await store.upsert(stdio())

    const onDisk = JSON.parse(readFileSync(join(dir, 'servers.json'), 'utf8'))
    onDisk.servers[0].title = 'Edited outside'
    writeFileSync(join(dir, 'servers.json'), JSON.stringify(onDisk))

    expect(store.get('alpha')!.title).toBe('Alpha')
    store.reload()
    expect(store.get('alpha')!.title).toBe('Edited outside')
  })
})

describe('ServerStore uniqueness', () => {
  it('rejects a second config with the same serverName', async () => {
    const store = new ServerStore({ dir: tempDir() })
    await store.init()
    await store.upsert(stdio({ id: 'one', serverName: 'shared' }))

    await expect(store.upsert(stdio({ id: 'two', serverName: 'shared' }))).rejects.toMatchObject({
      name: 'StoreError',
      code: 'duplicate-server-name',
    })
    expect(store.list()).toHaveLength(1)
  })

  it('rejects a persisted file with duplicate server names', () => {
    expect(() =>
      parseServersFile(
        JSON.stringify({
          version: STORE_FORMAT_VERSION,
          servers: [
            stdio({ id: 'one', serverName: 'shared' }),
            stdio({ id: 'two', serverName: 'shared' }),
          ],
        }),
      ),
    ).toThrow(StoreError)
  })
})

describe('ServerStore corruption handling', () => {
  it('quarantines invalid JSON and reports the move as a warning', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'servers.json'), '{ not json')

    const store = new ServerStore({ dir })
    const init = await store.init()

    expect(init.warnings).toHaveLength(1)
    expect(init.warnings[0]).toContain('moved aside')
    expect(existsSync(join(dir, 'servers.json'))).toBe(false)
    expect(store.list()).toEqual([])

    const quarantined = readdirSync(dir).filter((name) => name.startsWith('servers.corrupt-'))
    expect(quarantined).toHaveLength(1)
    expect(readFileSync(join(dir, quarantined[0]!), 'utf8')).toBe('{ not json')
  })

  it('quarantines a structurally invalid entry', async () => {
    const dir = tempDir()
    writeFileSync(
      join(dir, 'servers.json'),
      JSON.stringify({ version: STORE_FORMAT_VERSION, servers: [{ id: 'bad name!' }] }),
    )

    const store = new ServerStore({ dir })
    const init = await store.init()

    expect(init.warnings[0]).toContain('servers.json is invalid')
    expect(store.list()).toEqual([])
  })

  it('quarantines a future format version instead of misreading it', async () => {
    const dir = tempDir()
    writeFileSync(
      join(dir, 'servers.json'),
      JSON.stringify({ version: STORE_FORMAT_VERSION + 1, servers: [] }),
    )

    const store = new ServerStore({ dir })
    const init = await store.init()

    expect(init.warnings[0]).toContain('format version')
    expect(store.list()).toEqual([])
  })

  it('keeps working normally after a quarantine', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'servers.json'), 'broken')

    const store = new ServerStore({ dir })
    await store.init()
    await store.upsert(stdio())

    expect(store.list()).toHaveLength(1)
    expect(JSON.parse(readFileSync(join(dir, 'servers.json'), 'utf8')).version).toBe(
      STORE_FORMAT_VERSION,
    )
  })
})

describe('store file helpers', () => {
  it('accepts the legacy bare-array shape', () => {
    expect(parseServersFile(JSON.stringify([stdio()]))).toEqual([stdio()])
  })

  it('round-trips through serialize/parse', () => {
    const list = [stdio(), http()]
    const parsed = parseServersFile(serializeServersFile(list))
    expect(parsed).toHaveLength(2)
    expect(parsed[1]!.transport).toBe('streamable-http')
    expect(parsed[1]!.transport === 'streamable-http' ? parsed[1]!.url : '').toBe(
      'https://example.com/mcp',
    )
  })

  it('validates every contract field', () => {
    expect(() => validateServerConfig({ ...stdio(), toolCallTimeoutMs: 0 })).toThrow(StoreError)
    expect(() => validateServerConfig({ ...stdio(), serverName: 'bad name' })).toThrow(StoreError)
    expect(() => validateServerConfig({ ...stdio(), createdAt: 'not-a-date' })).toThrow(StoreError)
    expect(() =>
      validateServerConfig({ ...stdio(), transport: 'streamable-http' }),
    ).toThrow(StoreError)
    expect(() =>
      validateServerConfig({
        ...stdio(),
        transport: 'streamable-http',
        url: 'ftp://example.com',
      }),
    ).toThrow(StoreError)
  })

  it('drops unknown keys when validating', () => {
    const validated = validateServerConfig({ ...stdio(), extra: 'dropped' })
    expect(Object.hasOwn(validated, 'extra')).toBe(false)
  })
})
