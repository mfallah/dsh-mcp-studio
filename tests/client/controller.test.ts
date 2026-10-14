/**
 * Controller behaviour: reads, mutations, polling, and the states the views
 * render from. The fake host records every call, so "always re-read truth"
 * is an assertion rather than a hope.
 */
import { describe, expect, it } from 'vitest'
import { McpStudioController, busyKey, errorKey } from '../../src/client/state.js'
import { createFakeApi, createTestClock, flush, makeEntry, makeServer } from './fake-api.js'

function controllerFor(fake: ReturnType<typeof createFakeApi>, extra: Record<string, unknown> = {}) {
  const testClock = createTestClock()
  const controller = new McpStudioController({
    api: fake.api,
    clock: testClock.clock,
    ...extra,
  })
  return { controller, testClock }
}

describe('servers', () => {
  it('reads the list and exposes it as a ready view', async () => {
    const fake = createFakeApi({ servers: [makeServer()] })
    const { controller } = controllerFor(fake)

    await controller.loadServers()

    const snapshot = controller.getSnapshot()
    expect(snapshot.servers.phase).toBe('ready')
    expect(snapshot.servers.value).toHaveLength(1)
    expect(snapshot.servers.value[0]?.toolCount).toBe(2)
    expect(snapshot.serversReadAt).toBe(0)
  })

  it('keeps the last good list and marks it stale when a quiet poll fails', async () => {
    const fake = createFakeApi({ servers: [makeServer()] })
    const { controller } = controllerFor(fake)
    await controller.loadServers()

    fake.hooks.listServers = () => {
      throw new Error('route is down')
    }
    await controller.loadServers(true)

    const snapshot = controller.getSnapshot()
    expect(snapshot.servers.value).toHaveLength(1)
    expect(snapshot.servers.stale).toBe(true)
    expect(snapshot.servers.error).toContain('route is down')
  })

  it('reports a first-read failure as an error view with the host message', async () => {
    const fake = createFakeApi()
    fake.hooks.listServers = () => {
      throw new Error('connect ECONNREFUSED')
    }
    const { controller } = controllerFor(fake)

    await controller.loadServers()

    const snapshot = controller.getSnapshot()
    expect(snapshot.servers.phase).toBe('error')
    expect(snapshot.servers.error).toContain('ECONNREFUSED')
    expect(snapshot.servers.value).toEqual([])
  })

  it('re-reads from the host after a failed row action and keeps the error inline', async () => {
    const fake = createFakeApi({ servers: [makeServer()] })
    fake.hooks.setEnabled = () => {
      throw new Error('supervisor refused')
    }
    const { controller } = controllerFor(fake)
    await controller.loadServers()
    fake.reset()

    const result = await controller.toggleServer('files', false)

    expect(result.ok).toBe(false)
    expect(controller.errorOf(busyKey.server('files', 'toggle'))).toContain('supervisor refused')
    expect(fake.callsOf('listServers').length).toBeGreaterThanOrEqual(1)
  })

  it('closes the drawer when the selected server is removed', async () => {
    const fake = createFakeApi({ servers: [makeServer()] })
    const { controller } = controllerFor(fake)
    await controller.loadServers()
    controller.selectServer('files')
    await flush()
    expect(controller.getSnapshot().selection).toEqual({ kind: 'server', id: 'files' })

    await controller.removeServer('files')

    const snapshot = controller.getSnapshot()
    expect(snapshot.selection).toBeNull()
    expect(snapshot.servers.value).toHaveLength(0)
    expect(fake.callsOf('removeServer')).toHaveLength(1)
  })

  it('marks the row busy while the action is in flight', async () => {
    const fake = createFakeApi()
    let release: (() => void) | null = null
    fake.hooks.addServer = () =>
      new Promise((resolve) => {
        release = () => resolve(makeServer({ id: 'manual', serverName: 'manual' }))
      })
    const { controller } = controllerFor(fake)

    const pending = controller.install({ transport: 'stdio', title: 'Manual', command: 'npx' })
    await flush()

    expect(controller.isBusy(busyKey.install)).toBe(true)
    expect(controller.getSnapshot().busy.has(busyKey.install)).toBe(true)

    release?.()
    await pending

    expect(controller.isBusy(busyKey.install)).toBe(false)
    expect(controller.getSnapshot().busy.has(busyKey.install)).toBe(false)
  })
})

describe('catalog', () => {
  it('narrows the list through the host when a query is set', async () => {
    const fake = createFakeApi({
      catalog: {
        entries: [
          makeEntry(),
          makeEntry({ id: 'curated:github', slug: 'github', title: 'GitHub', categories: ['git'] }),
        ],
        total: 2,
        registryOnline: true,
      },
      categories: ['files', 'git'],
    })
    const { controller } = controllerFor(fake)
    await controller.loadCatalog()
    expect(controller.getSnapshot().catalog.value).toHaveLength(2)

    controller.setCatalogQuery({ text: 'github' })
    await flush()

    const snapshot = controller.getSnapshot()
    expect(fake.lastCall('catalog')?.args[0]).toEqual({ text: 'github' })
    expect(snapshot.catalog.value.map((entry) => entry.title)).toEqual(['GitHub'])
    expect(snapshot.catalog.total).toBe(1)
    expect(snapshot.categories).toEqual(['files', 'git'])
  })

  it('keeps curated entries and the registry reason when the registry is offline', async () => {
    const fake = createFakeApi({
      catalog: {
        entries: [makeEntry()],
        total: 1,
        registryOnline: false,
        registryError: 'registry timed out',
      },
    })
    const { controller } = controllerFor(fake)

    await controller.loadCatalog()

    const snapshot = controller.getSnapshot()
    expect(snapshot.catalog.registryOnline).toBe(false)
    expect(snapshot.catalog.registryError).toBe('registry timed out')
    expect(snapshot.catalog.value).toHaveLength(1)
  })

  it('reports a catalog failure as an error view', async () => {
    const fake = createFakeApi()
    fake.hooks.catalog = () => {
      throw new Error('catalog store unreadable')
    }
    const { controller } = controllerFor(fake)

    await controller.loadCatalog()

    const snapshot = controller.getSnapshot()
    expect(snapshot.catalog.phase).toBe('error')
    expect(snapshot.catalog.error).toContain('catalog store unreadable')
  })
})

describe('install', () => {
  it('installs through the host template and opens the new server', async () => {
    const entry = makeEntry()
    const fake = createFakeApi({
      catalog: { entries: [entry], total: 1, registryOnline: true },
    })
    const { controller } = controllerFor(fake)
    await controller.loadCatalog()
    fake.reset()

    const result = await controller.installCatalogEntry(entry, { root: '/tmp/data' })

    expect(result.ok).toBe(true)
    expect(result.secretsStored).toBe(true)
    expect(fake.lastCall('installFromCatalog')?.args).toEqual(['curated:filesystem', { root: '/tmp/data' }])
    expect(fake.callsOf('addServer')).toHaveLength(1)
    const snapshot = controller.getSnapshot()
    expect(snapshot.tab).toBe('installed')
    expect(snapshot.selection).toEqual({ kind: 'server', id: 'filesystem' })
    // Truth was re-read after the write.
    expect(fake.callsOf('listServers').length).toBeGreaterThanOrEqual(1)
  })

  it('surfaces an install failure inline and still re-reads the list', async () => {
    const fake = createFakeApi({
      catalog: { entries: [makeEntry()], total: 1, registryOnline: true },
    })
    fake.hooks.addServer = () => {
      throw new Error('port already in use')
    }
    const { controller } = controllerFor(fake)
    await controller.loadCatalog()
    fake.reset()

    const result = await controller.installCatalogEntry(makeEntry(), { root: '/tmp' })

    expect(result.ok).toBe(false)
    expect(result.error).toContain('port already in use')
    expect(controller.errorOf(errorKey.install)).toContain('port already in use')
    expect(fake.callsOf('listServers')).toHaveLength(1)
    expect(controller.getSnapshot().tab).toBe('catalog')
  })

  it('stores a catalog secret answer under its input key before building the draft', async () => {
    const entry = makeEntry({
      args: ['-y', '@scope/server', '--token={input:token}', '{input:root}'],
      inputs: [
        { key: 'root', label: 'Root', required: true, secret: false, format: 'directory' },
        { key: 'token', label: 'Token', required: true, secret: true, format: 'password' },
      ],
    })
    const fake = createFakeApi({ catalog: { entries: [entry], total: 1, registryOnline: true } })
    const { controller } = controllerFor(fake)
    await controller.loadCatalog()
    fake.reset()

    const result = await controller.installCatalogEntry(entry, { root: '/tmp/data', token: 'hunter2' })

    expect(result.ok).toBe(true)
    expect(result.secretsStored).toBe(true)
    expect(fake.lastCall('setSecret')?.args).toEqual(['token', 'hunter2'])

    const order = fake.calls.map((call) => call.method)
    expect(order.indexOf('setSecret')).toBeLessThan(order.indexOf('installFromCatalog'))
    expect(order.indexOf('installFromCatalog')).toBeLessThan(order.indexOf('addServer'))

    const draft = fake.lastCall('addServer')?.args[0] as { args: string[] }
    expect(draft.args.join(' ')).toContain('--token=${secret:token}')
    expect(draft.args).toContain('/tmp/data')
    expect(JSON.stringify(draft)).not.toContain('hunter2')
    // The host answer is the only thing the draft carries, and the new secret
    // name is visible in the store listing afterwards.
    expect(fake.callsOf('listSecretNames').length).toBeGreaterThanOrEqual(1)
    expect(fake.state.secrets).toContain('token')
  })

  it('a rejected secret write stops the install before any draft is built', async () => {
    const entry = makeEntry({
      args: ['-y', '@scope/server', '{input:token}'],
      inputs: [{ key: 'token', label: 'Token', required: true, secret: true, format: 'password' }],
    })
    const fake = createFakeApi({ catalog: { entries: [entry], total: 1, registryOnline: true } })
    fake.hooks.setSecret = () => {
      throw new Error('secret store is read-only')
    }
    const { controller } = controllerFor(fake)
    await controller.loadCatalog()
    fake.reset()

    const result = await controller.installCatalogEntry(entry, { token: 'hunter2' })

    expect(result.ok).toBe(false)
    expect(result.secretsStored).toBe(false)
    expect(result.error).toContain('secret store is read-only')
    expect(controller.errorOf(errorKey.install)).toContain('secret store is read-only')
    expect(fake.callsOf('installFromCatalog')).toHaveLength(0)
    expect(fake.callsOf('addServer')).toHaveLength(0)
    expect(fake.callsOf('listServers')).toHaveLength(1)
  })
})

describe('probe', () => {
  it('renders a successful probe with the discovered tools', async () => {
    const fake = createFakeApi({
      catalog: { entries: [makeEntry()], total: 1, registryOnline: true },
      probe: { ok: true, durationMs: 42, tools: ['read_file', 'write_file'], protocolVersion: '2025-06-18' },
    })
    const { controller } = controllerFor(fake)

    const outcome = await controller.testCatalogEntry(makeEntry(), { root: '/tmp' })

    expect(outcome.ok).toBe(true)
    const probe = controller.getSnapshot().probe
    expect(probe.phase).toBe('ready')
    expect(probe.value?.ok).toBe(true)
    expect(probe.value?.tools).toHaveLength(2)
    expect(probe.value?.durationMs).toBe(42)
  })

  it('stores secret answers before probing, and stops when the write fails', async () => {
    const entry = makeEntry({
      args: ['-y', '@scope/server', '{input:token}'],
      inputs: [{ key: 'token', label: 'Token', required: true, secret: true, format: 'password' }],
    })
    const fake = createFakeApi({ catalog: { entries: [entry], total: 1, registryOnline: true } })
    const { controller } = controllerFor(fake)

    const outcome = await controller.testCatalogEntry(entry, { token: 'hunter2' })

    expect(outcome.ok).toBe(true)
    expect(outcome.secretsStored).toBe(true)
    expect(fake.lastCall('setSecret')?.args).toEqual(['token', 'hunter2'])
    expect(fake.callsOf('testConnection')).toHaveLength(1)
    const order = fake.calls.map((call) => call.method)
    expect(order.indexOf('setSecret')).toBeLessThan(order.indexOf('installFromCatalog'))
    expect(order.indexOf('installFromCatalog')).toBeLessThan(order.indexOf('testConnection'))

    fake.hooks.setSecret = () => {
      throw new Error('secret store is read-only')
    }
    const failed = await controller.testCatalogEntry(entry, { token: 'hunter2' })

    expect(failed.ok).toBe(false)
    expect(failed.secretsStored).toBe(false)
    expect(controller.getSnapshot().probe.phase).toBe('error')
    expect(controller.getSnapshot().probe.error).toContain('read-only')
    expect(fake.callsOf('testConnection')).toHaveLength(1)
  })

  it('renders a failed probe as an error state, not a crash', async () => {
    const fake = createFakeApi()
    fake.hooks.testConnection = () => {
      throw new Error('spawn npx ENOENT')
    }
    const { controller } = controllerFor(fake)

    const result = await controller.testDraft({ transport: 'stdio', title: 'X', command: 'npx' })

    expect(result).toBeNull()
    expect(controller.getSnapshot().probe.phase).toBe('error')
    expect(controller.getSnapshot().probe.error).toContain('ENOENT')
  })
})

describe('logs', () => {
  it('tails incrementally, dedupes by seq, and caps the buffer', async () => {
    const fake = createFakeApi({ servers: [makeServer()] })
    const { controller, testClock } = controllerFor(fake, { maxLogLines: 3 })
    await controller.loadServers()

    fake.state.logChunks = [
      {
        serverId: 'files',
        entries: [
          { seq: 1, at: '2026-01-01T00:00:00.000Z', level: 'info', message: 'first' },
          { seq: 2, at: '2026-01-01T00:00:01.000Z', level: 'warn', message: 'second' },
        ],
        nextSeq: 2,
      },
    ]

    controller.selectServer('files')
    await flush()
    expect(controller.getSnapshot().logs.map((entry) => entry.seq)).toEqual([1, 2])

    await testClock.advance(2000)
    expect(fake.lastCall('getLogs')?.args).toEqual(['files', 2])

    // A repeated chunk must not duplicate anything.
    await testClock.advance(2000)
    expect(controller.getSnapshot().logs).toHaveLength(2)

    fake.state.logChunks.push({
      serverId: 'files',
      entries: [
        { seq: 3, at: '2026-01-01T00:00:02.000Z', level: 'error', message: 'third' },
        { seq: 4, at: '2026-01-01T00:00:03.000Z', level: 'info', message: 'fourth' },
      ],
      nextSeq: 4,
    })
    await testClock.advance(2000)

    const logs = controller.getSnapshot().logs
    expect(logs).toHaveLength(3)
    expect(logs.map((entry) => entry.seq)).toEqual([2, 3, 4])
  })

  it('stops tailing when the drawer closes', async () => {
    const fake = createFakeApi({ servers: [makeServer()] })
    const { controller, testClock } = controllerFor(fake)
    await controller.loadServers()

    controller.selectServer('files')
    await flush()
    expect(testClock.active()).toBe(1)

    controller.closeSelection()
    expect(testClock.active()).toBe(0)
    await testClock.advance(2000)
    expect(fake.callsOf('getLogs')).toHaveLength(1)
  })
})

describe('secrets', () => {
  it('stores, lists and deletes names, never values', async () => {
    const fake = createFakeApi({ secrets: ['EXISTING'] })
    const { controller } = controllerFor(fake)
    await controller.loadSecrets()
    expect(controller.getSnapshot().secrets.value).toEqual(['EXISTING'])

    const saved = await controller.saveSecret('NEW_KEY', 'hunter2')
    expect(saved.ok).toBe(true)
    expect(fake.lastCall('setSecret')?.args).toEqual(['NEW_KEY', 'hunter2'])
    expect(controller.getSnapshot().secrets.value).toEqual(['EXISTING', 'NEW_KEY'])

    await controller.removeSecret('EXISTING')
    expect(fake.callsOf('deleteSecret')).toHaveLength(1)
    expect(controller.getSnapshot().secrets.value).toEqual(['NEW_KEY'])
  })

  it('reports a secret write failure inline', async () => {
    const fake = createFakeApi()
    fake.hooks.setSecret = () => {
      throw new Error('secret store is read-only')
    }
    const { controller } = controllerFor(fake)

    const result = await controller.saveSecret('KEY', 'value')

    expect(result.ok).toBe(false)
    expect(controller.errorOf(errorKey.secrets)).toContain('read-only')
  })
})

describe('patch export', () => {
  it('stores the generated patch', async () => {
    const fake = createFakeApi({ patch: "insert:\n  - id: mcp-studio\n" })
    const { controller } = controllerFor(fake)

    const result = await controller.exportPatch()

    expect(result.ok).toBe(true)
    expect(controller.getSnapshot().patch.value).toContain('mcp-studio')
    expect(controller.isBusy(busyKey.patch)).toBe(false)
  })

  it('reports a patch failure as an error view', async () => {
    const fake = createFakeApi()
    fake.hooks.exportPatch = () => {
      throw new Error('serializer exploded')
    }
    const { controller } = controllerFor(fake)

    await controller.exportPatch()

    expect(controller.getSnapshot().patch.phase).toBe('error')
    expect(controller.errorOf(errorKey.patch)).toContain('serializer exploded')
  })
})

describe('polling', () => {
  it('polls only while the panel is visible', async () => {
    const fake = createFakeApi({ servers: [makeServer()] })
    const { controller, testClock } = controllerFor(fake)

    controller.setVisible(true)
    await flush()
    const afterMount = fake.callsOf('listServers').length
    expect(afterMount).toBe(1)
    expect(testClock.active()).toBe(1)

    await testClock.advance(5000)
    expect(fake.callsOf('listServers').length).toBe(afterMount + 1)

    controller.setVisible(false)
    expect(testClock.active()).toBe(0)
    await testClock.advance(5000)
    expect(fake.callsOf('listServers').length).toBe(afterMount + 1)
  })

  it('refetches everything the panel shows when it becomes visible again', async () => {
    const fake = createFakeApi()
    const { controller } = controllerFor(fake)

    controller.setVisible(true)
    await flush()

    expect(fake.callsOf('listServers')).toHaveLength(1)
    expect(fake.callsOf('catalog')).toHaveLength(1)
    expect(fake.callsOf('detectRuntimes')).toHaveLength(1)
    expect(fake.callsOf('listSecretNames')).toHaveLength(1)
  })

  it('disposes every timer', async () => {
    const fake = createFakeApi({ servers: [makeServer()] })
    const { controller, testClock } = controllerFor(fake)
    controller.setVisible(true)
    controller.selectServer('files')
    await flush()

    controller.dispose()

    expect(testClock.active()).toBe(0)
  })
})
