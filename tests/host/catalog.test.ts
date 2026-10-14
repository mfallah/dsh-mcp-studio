import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  buildRegistryUrl,
  CatalogService,
  dedupeKey,
  inputFromVariable,
  isExactMatch,
  normalizeRegistryPage,
  normalizeRegistryServer,
  rankEntries,
  REGISTRY_PATH,
  slugifyRegistryName,
} from '../../src/host/catalog.js'
import type { CatalogEntry, CatalogInput } from '../../src/shared/contract.js'

const FIXTURE = JSON.parse(
  readFileSync(new URL('./fixtures/registry-v0.1.json', import.meta.url), 'utf8'),
) as unknown

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function entry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    id: 'curated:demo',
    source: 'curated',
    slug: 'demo',
    title: 'Demo',
    description: 'A demo entry',
    publisher: 'Test',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'demo'],
    inputs: [],
    categories: ['demo', 'testing'],
    offline: true,
    ...overrides,
  }
}

describe('buildRegistryUrl', () => {
  it('uses the frozen v0.1 preview path', () => {
    const url = new URL(buildRegistryUrl('https://registry.modelcontextprotocol.io'))
    expect(url.pathname).toBe(REGISTRY_PATH)
    expect(REGISTRY_PATH).toBe('/v0.1/servers')
    expect(url.search).toBe('')
  })

  it('passes search, limit and cursor as registry parameters', () => {
    const url = new URL(
      buildRegistryUrl('https://registry.modelcontextprotocol.io/', {
        search: 'git hub',
        limit: 25,
        cursor: 'abc==',
      }),
    )
    expect(url.pathname).toBe('/v0.1/servers')
    expect(url.searchParams.get('search')).toBe('git hub')
    expect(url.searchParams.get('limit')).toBe('25')
    expect(url.searchParams.get('cursor')).toBe('abc==')
  })

  it('omits an empty search', () => {
    const url = new URL(buildRegistryUrl('https://example.com', { search: '   ' }))
    expect(url.search).toBe('')
  })
})

describe('inputFromVariable', () => {
  it('maps a secret variable to a password input', () => {
    expect(
      inputFromVariable({ name: 'API_KEY', description: 'Key', isRequired: true, isSecret: true }),
    ).toEqual({
      key: 'API_KEY',
      label: 'API_KEY',
      required: true,
      secret: true,
      format: 'password',
      description: 'Key',
    })
  })

  it('maps filepath to file and keeps other formats', () => {
    expect(inputFromVariable({ name: 'db', format: 'filepath' })?.format).toBe('file')
    expect(inputFromVariable({ name: 'port', format: 'number' })?.format).toBe('number')
    expect(inputFromVariable({ name: 'on', format: 'boolean' })?.format).toBe('boolean')
    expect(inputFromVariable({ name: 'plain' })?.format).toBe('string')
  })

  it('folds choices into the description because the contract has no enum field', () => {
    const input = inputFromVariable({
      name: 'LOG_LEVEL',
      description: 'Verbosity.',
      choices: ['debug', 'info'],
    })
    expect(input).toMatchObject({ format: 'string', required: false, secret: false })
    expect(input?.description).toBe('Verbosity. One of: debug, info.')
  })

  it('stringifies a default and keeps a placeholder', () => {
    const input = inputFromVariable({ name: 'RETRIES', default: 3, placeholder: '3' })
    expect(input?.defaultValue).toBe('3')
    expect(input?.placeholder).toBe('3')
  })

  it('returns null without a name', () => {
    expect(inputFromVariable({ description: 'anonymous' })).toBeNull()
  })
})

describe('normalizeRegistryPage', () => {
  const page = normalizeRegistryPage(FIXTURE)

  it('keeps only entries with a launch target', () => {
    expect(page.entries.map((e) => e.id)).toEqual([
      'registry:io-github-modelcontextprotocol-server-everything',
      'registry:io-github-example-demo-fetch',
      'registry:com-example-remote-search',
      'registry:com-example-oci-tool',
    ])
  })

  it('reads the pagination cursor', () => {
    expect(page.nextCursor).toBe('cursor-page-2')
  })

  it('marks the latest version as popular', () => {
    expect(page.popularity.get('registry:io-github-modelcontextprotocol-server-everything')).toBe(1)
    expect(page.popularity.get('registry:com-example-remote-search')).toBe(0)
  })

  it('normalizes an npm stdio package', () => {
    const [everything] = page.entries
    expect(everything).toMatchObject({
      source: 'registry',
      title: 'Everything',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-everything@1.0.0'],
      publisher: 'modelcontextprotocol',
      version: '1.0.0',
      homepage: 'https://github.com/modelcontextprotocol/servers',
      offline: false,
      categories: ['registry', 'stdio'],
    })
    expect(everything!.inputs).toEqual([
      {
        key: 'LOG_LEVEL',
        label: 'LOG_LEVEL',
        required: false,
        secret: false,
        format: 'string',
        description: 'Verbosity of the server log. One of: debug, info, warn, error.',
        defaultValue: 'info',
      },
    ])
  })

  it('turns environment variables and arguments into inputs, appending argv placeholders', () => {
    const demo = page.entries.find((e) => e.slug === 'io-github-example-demo-fetch')!
    expect(demo.command).toBe('uvx')
    expect(demo.args).toEqual(['demo-fetch', '{input:ALLOWED_HOSTS}'])
    expect(demo.inputs.map((input) => input.key)).toEqual(['DEMO_API_KEY', 'ALLOWED_HOSTS'])
    expect(demo.inputs[0]).toMatchObject({ secret: true, format: 'password', required: true })
    expect(demo.inputs[1]).toMatchObject({
      secret: false,
      format: 'string',
      required: true,
      placeholder: 'example.com,localhost',
    })
  })

  it('normalizes a streamable-http remote', () => {
    const remote = page.entries.find((e) => e.slug === 'com-example-remote-search')!
    expect(remote).toMatchObject({
      transport: 'streamable-http',
      url: 'https://search.example.com/mcp',
      categories: ['registry', 'remote'],
    })
  })

  it('normalizes an oci package as a docker launch', () => {
    const oci = page.entries.find((e) => e.slug === 'com-example-oci-tool')!
    expect(oci).toMatchObject({
      command: 'docker',
      args: ['run', '-i', '--rm', 'docker.io/example/tool:1.2.3'],
      categories: ['registry', 'container'],
    })
  })

  it('never throws on a malformed body', () => {
    for (const body of [null, 42, 'text', [], { servers: 'nope' }, { servers: {} }]) {
      expect(() => normalizeRegistryPage(body)).not.toThrow()
      expect(normalizeRegistryPage(body).entries).toEqual([])
    }
  })

  it('accepts an unwrapped server object', () => {
    const bare = normalizeRegistryServer({
      name: 'com.example/bare',
      packages: [{ registryType: 'npm', identifier: 'bare-pkg' }],
    })
    expect(bare?.id).toBe('registry:com-example-bare')
    expect(bare?.args).toEqual(['-y', 'bare-pkg'])
  })

  it('slugifies long reverse-DNS names without collapsing them', () => {
    expect(slugifyRegistryName('io.github.modelcontextprotocol/server-everything')).toBe(
      'io-github-modelcontextprotocol-server-everything',
    )
    expect(slugifyRegistryName('com.example/a')).not.toBe(slugifyRegistryName('com.example/b'))
  })
})

describe('ranking', () => {
  const popular = entry({ id: 'registry:popular', source: 'registry', slug: 'popular', title: 'Popular', offline: false })
  const exact = entry({ id: 'curated:target', slug: 'target', title: 'Target' })
  const alphabetical = entry({ id: 'curated:aaa', slug: 'aaa', title: 'AAA' })

  it('puts an exact name match first even behind a more popular entry', () => {
    const ranked = rankEntries(
      [popular, alphabetical, exact],
      'target',
      new Map([['registry:popular', 9]]),
    )
    // Exact match wins outright; popularity then decides before the title.
    expect(ranked.map((e) => e.id)).toEqual(['curated:target', 'registry:popular', 'curated:aaa'])
  })

  it('then sorts by popularity, then title, then id', () => {
    const ranked = rankEntries(
      [alphabetical, popular],
      '',
      new Map([
        ['registry:popular', 1],
        ['curated:aaa', 0],
      ]),
    )
    expect(ranked.map((e) => e.id)).toEqual(['registry:popular', 'curated:aaa'])
  })

  it('is stable and deterministic for equal ranks', () => {
    const first = rankEntries([alphabetical, popular], '')
    const second = rankEntries([popular, alphabetical], '')
    expect(first.map((e) => e.id)).toEqual(second.map((e) => e.id))
  })

  it('computes a dedupe key that ignores a pinned version', () => {
    const pinned = entry({
      id: 'registry:x',
      source: 'registry',
      args: ['-y', '@scope/pkg@1.2.3'],
      offline: false,
    })
    const unpinned = entry({ id: 'curated:x', args: ['-y', '@scope/pkg@latest'] })
    expect(dedupeKey(pinned)).toBe(dedupeKey(unpinned))
  })

  it('isExactMatch only fires on the slug, id or title', () => {
    expect(isExactMatch(exact, 'target')).toBe(true)
    expect(isExactMatch(exact, 'TARGET')).toBe(true)
    expect(isExactMatch(exact, 'tar')).toBe(false)
    expect(isExactMatch(exact, '')).toBe(false)
  })
})

describe('CatalogService.search', () => {
  function service(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
    return new CatalogService({
      registryUrl: 'https://registry.modelcontextprotocol.io',
      enabled: true,
      fetchImpl,
      ...overrides,
    })
  }

  it('merges curated and registry results', async () => {
    const page = await service(async () => jsonResponse(FIXTURE)).search({ text: '' })
    expect(page.registryOnline).toBe(true)
    expect(page.registryError).toBeUndefined()
    expect(page.entries.some((e) => e.source === 'curated')).toBe(true)
    expect(page.entries.some((e) => e.source === 'registry')).toBe(true)
    expect(page.total).toBeGreaterThan(page.entries.length - 1)
  })

  it('ranks an exact curated slug above registry noise', async () => {
    const page = await service(async () => jsonResponse(FIXTURE)).search({ text: 'filesystem' })
    expect(page.entries[0]!.id).toBe('curated:filesystem')
  })

  it('degrades to curated-only when the registry throws', async () => {
    const page = await service(async () => {
      throw new Error('getaddrinfo ENOTFOUND')
    }).search({ text: '' })

    expect(page.registryOnline).toBe(false)
    expect(page.registryError).toContain('ENOTFOUND')
    expect(page.entries.length).toBeGreaterThan(0)
    expect(page.entries.every((e) => e.source === 'curated')).toBe(true)
  })

  it('degrades when the registry answers with an error status', async () => {
    const page = await service(async () => jsonResponse({ error: 'nope' }, 503)).search({})
    expect(page.registryOnline).toBe(false)
    expect(page.registryError).toContain('503')
    expect(page.entries.every((e) => e.source === 'curated')).toBe(true)
  })

  it('never contacts the registry when disabled', async () => {
    let calls = 0
    const page = await service(
      async () => {
        calls += 1
        return jsonResponse(FIXTURE)
      },
      { enabled: false },
    ).search({})

    expect(calls).toBe(0)
    expect(page.registryOnline).toBe(false)
    expect(page.registryError).toContain('disabled')
    expect(page.entries.every((e) => e.source === 'curated')).toBe(true)
  })

  it('does not contact the registry for a curated-only query', async () => {
    let calls = 0
    const catalog = service(async () => {
      calls += 1
      return jsonResponse(FIXTURE)
    })
    const page = await catalog.search({ source: 'curated' })
    expect(calls).toBe(0)
    expect(page.entries.every((e) => e.source === 'curated')).toBe(true)
  })

  it('caches a registry page for the TTL', async () => {
    let calls = 0
    let clock = 0
    const catalog = new CatalogService({
      registryUrl: 'https://registry.modelcontextprotocol.io',
      enabled: true,
      now: () => clock,
      fetchImpl: async () => {
        calls += 1
        return jsonResponse(FIXTURE)
      },
    })

    await catalog.search({ text: 'a' })
    const afterFirst = calls
    expect(afterFirst).toBeGreaterThan(0)

    await catalog.search({ text: 'a' })
    expect(calls).toBe(afterFirst)

    clock += 10 * 60_000
    await catalog.search({ text: 'a' })
    expect(calls).toBeGreaterThan(afterFirst)
  })

  it('applies limit after ranking and reports the full total', async () => {
    const catalog = service(async () => jsonResponse(FIXTURE))
    const all = await catalog.search({})
    const limited = await catalog.search({ limit: 3 })
    expect(limited.entries).toHaveLength(3)
    expect(limited.total).toBe(all.total)
    expect((await catalog.search({ limit: 0 })).entries).toEqual([])
  })

  it('filters by category and by source', async () => {
    const catalog = service(async () => jsonResponse(FIXTURE))
    const browsers = await catalog.search({ category: 'browser' })
    expect(browsers.entries.map((e) => e.slug)).toEqual(
      expect.arrayContaining(['playwright', 'puppeteer']),
    )
    expect(browsers.entries.every((e) => e.categories.includes('browser'))).toBe(true)

    const registryOnly = await catalog.search({ source: 'registry' })
    expect(registryOnly.entries.every((e) => e.source === 'registry')).toBe(true)
  })

  it('matches text across title, description and categories', async () => {
    const catalog = service(async () => jsonResponse(FIXTURE))
    const page = await catalog.search({ text: 'postgres' })
    expect(page.entries.map((e) => e.slug)).toContain('postgres')
  })

  it('follows the next cursor across pages', async () => {
    const bodies: string[] = []
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input)
      bodies.push(url)
      if (url.includes('cursor-page-2')) {
        return jsonResponse({
          servers: [
            {
              server: {
                name: 'com.example/page-two',
                packages: [{ registryType: 'npm', identifier: 'page-two' }],
              },
            },
          ],
        })
      }
      return jsonResponse(FIXTURE)
    }
    const page = await service(fetchImpl).search({})
    expect(bodies).toHaveLength(2)
    expect(page.entries.some((e) => e.slug === 'com-example-page-two')).toBe(true)
  })

  it('treats an unparseable registry body as no registry results', async () => {
    const page = await service(async () => jsonResponse({ unexpected: true })).search({})
    expect(page.registryOnline).toBe(true)
    expect(page.entries.every((e) => e.source === 'curated')).toBe(true)
  })
})

describe('CatalogService.findById', () => {
  it('finds curated entries synchronously without network', async () => {
    let calls = 0
    const catalog = new CatalogService({
      registryUrl: 'https://registry.modelcontextprotocol.io',
      enabled: true,
      fetchImpl: async () => {
        calls += 1
        return jsonResponse(FIXTURE)
      },
    })

    expect(catalog.findById('curated:filesystem')?.slug).toBe('filesystem')
    expect(catalog.findById('filesystem')?.id).toBe('curated:filesystem')
    expect(calls).toBe(0)
  })

  it('returns undefined for unknown ids and finds registry entries after a search', async () => {
    const catalog = new CatalogService({
      registryUrl: 'https://registry.modelcontextprotocol.io',
      enabled: true,
      fetchImpl: async () => jsonResponse(FIXTURE),
    })

    expect(catalog.findById('registry:com-example-remote-search')).toBeUndefined()
    await catalog.search({})
    expect(catalog.findById('registry:com-example-remote-search')?.transport).toBe(
      'streamable-http',
    )
    expect(catalog.findById('nope')).toBeUndefined()
  })
})

describe('CatalogService.categories', () => {
  it('unions curated and registry categories', async () => {
    const catalog = new CatalogService({
      registryUrl: 'https://registry.modelcontextprotocol.io',
      enabled: true,
      fetchImpl: async () => jsonResponse(FIXTURE),
    })
    const categories = await catalog.categories()
    expect(categories).toContain('filesystem')
    expect(categories).toContain('browser')
    expect(categories).toContain('registry')
    expect(categories).toEqual([...categories].sort())
  })

  it('still returns curated categories when the registry is down', async () => {
    const catalog = new CatalogService({
      registryUrl: 'https://registry.modelcontextprotocol.io',
      enabled: true,
      fetchImpl: async () => {
        throw new Error('offline')
      },
    })
    expect(await catalog.categories()).toContain('filesystem')
  })
})

describe('every curated entry is well formed', () => {
  const catalog = new CatalogService({
    registryUrl: 'https://registry.modelcontextprotocol.io',
    enabled: false,
  })

  it('resolves ids and exposes a valid input shape', () => {
    for (const item of catalog.curatedEntries) {
      expect(catalog.findById(item.id)?.id).toBe(item.id)
      for (const input of item.inputs as CatalogInput[]) {
        expect(input.key).toMatch(/^[A-Za-z0-9._-]{1,64}$/)
        expect(typeof input.required).toBe('boolean')
        expect(typeof input.secret).toBe('boolean')
        expect(['string', 'number', 'boolean', 'file', 'directory', 'password']).toContain(
          input.format,
        )
      }
    }
  })
})
