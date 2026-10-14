import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  icaclsArgs,
  SecretStore,
  secretRefsIn,
  tightenFileAcl,
} from '../../src/host/secrets.js'
import { STORE_FORMAT_VERSION, type ServerConfig } from '../../src/shared/contract.js'

const dirs: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mcp-studio-secrets-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop()
    if (dir) rmSync(dir, { recursive: true, force: true })
  }
})

function store(dir: string): SecretStore {
  return new SecretStore({ dir, tightenAcl: false })
}

describe('SecretStore', () => {
  it('creates the directory and starts empty', async () => {
    const dir = join(tempDir(), 'nested')
    const secrets = store(dir)
    const init = await secrets.init()

    expect(init.warnings).toEqual([])
    expect(existsSync(dir)).toBe(true)
    expect(secrets.names()).toEqual([])
  })

  it('stores, reads and deletes values', async () => {
    const secrets = store(tempDir())
    await secrets.init()

    await secrets.set('braveApiKey', 'tvly-secret-value')
    expect(secrets.get('braveApiKey')).toBe('tvly-secret-value')
    expect(secrets.has('braveApiKey')).toBe(true)

    await secrets.delete('braveApiKey')
    expect(secrets.get('braveApiKey')).toBeUndefined()
    expect(secrets.has('braveApiKey')).toBe(false)
    expect(secrets.names()).toEqual([])
  })

  it('lists names sorted, never values', async () => {
    const secrets = store(tempDir())
    await secrets.init()
    await secrets.set('zeta', 'value-zeta')
    await secrets.set('alpha', 'value-alpha')
    await secrets.set('mid', 'value-mid')

    expect(secrets.names()).toEqual(['alpha', 'mid', 'zeta'])
    const exposed = secrets.names().join('|')
    expect(exposed).not.toContain('value-')
    expect(exposed).not.toContain('value-alpha')
  })

  it('persists across instances', async () => {
    const dir = tempDir()
    const first = store(dir)
    await first.init()
    await first.set('githubToken', 'ghp_value')

    const second = store(dir)
    await second.init()
    expect(second.get('githubToken')).toBe('ghp_value')
    expect(second.names()).toEqual(['githubToken'])
  })

  it('writes the versioned envelope', async () => {
    const dir = tempDir()
    const secrets = store(dir)
    await secrets.init()
    await secrets.set('alpha', 'value')

    const raw = JSON.parse(readFileSync(join(dir, 'secrets.json'), 'utf8'))
    expect(raw).toEqual({ version: STORE_FORMAT_VERSION, secrets: { alpha: 'value' } })
  })

  it('returns undefined for unknown or malformed names', async () => {
    const secrets = store(tempDir())
    await secrets.init()
    expect(secrets.get('missing')).toBeUndefined()
    expect(secrets.get('has space')).toBeUndefined()
    expect(secrets.has('has space')).toBe(false)
  })

  it('rejects malformed names on write', async () => {
    const secrets = store(tempDir())
    await secrets.init()
    await expect(secrets.set('bad name', 'x')).rejects.toMatchObject({ code: 'invalid' })
    await expect(secrets.delete('bad name')).rejects.toMatchObject({ code: 'invalid' })
  })

  it('replaces an existing value on set', async () => {
    const secrets = store(tempDir())
    await secrets.init()
    await secrets.set('token', 'one')
    await secrets.set('token', 'two')
    expect(secrets.get('token')).toBe('two')
    expect(secrets.names()).toEqual(['token'])
  })

  it('treats deleting an unknown name as a no-op', async () => {
    const secrets = store(tempDir())
    await secrets.init()
    await expect(secrets.delete('nope')).resolves.toBeUndefined()
  })

  it('quarantines a corrupt file and warns', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'secrets.json'), '{ nope')

    const secrets = store(dir)
    const init = await secrets.init()

    expect(init.warnings).toHaveLength(1)
    expect(init.warnings[0]).toContain('moved aside')
    expect(existsSync(join(dir, 'secrets.json'))).toBe(false)
    expect(secrets.names()).toEqual([])
    expect(readdirSync(dir).some((name) => name.startsWith('secrets.corrupt-'))).toBe(true)
  })

  it('resolves `${secret:name}` placeholders and bare names', async () => {
    const secrets = store(tempDir())
    await secrets.init()
    await secrets.set('alpha', 'value')

    expect(secrets.resolve('${secret:alpha}')).toBe('value')
    expect(secrets.resolve('alpha')).toBe('value')
    expect(secrets.resolve('${secret:missing}')).toBeUndefined()
  })
})

describe('secret references in configs', () => {
  it('extracts secret names from stdio env and http headers', () => {
    const stdio = {
      id: 'one',
      serverName: 'one',
      title: 'One',
      transport: 'stdio',
      enabled: true,
      source: 'custom',
      failOnStartupError: false,
      toolCallTimeoutMs: 60_000,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      command: 'npx',
      args: [],
      env: { A: '${secret:alpha}', B: 'literal', C: '${secret:beta}', D: '${secret:alpha}' },
    } as ServerConfig

    expect(secretRefsIn(stdio)).toEqual(['alpha', 'beta'])

    const http = {
      ...stdio,
      transport: 'streamable-http',
      url: 'https://example.com/mcp',
      headers: { Authorization: '${secret:gamma}' },
    } as ServerConfig

    expect(secretRefsIn(http)).toEqual(['gamma'])
  })
})

describe('windows ACL hardening', () => {
  it('builds an icacls command that drops inheritance and grants only the user', () => {
    expect(icaclsArgs('C:\\store\\secrets.json', 'me')).toEqual([
      'C:\\store\\secrets.json',
      '/inheritance:r',
      '/grant:r',
      'me:F',
    ])
  })

  it('is a no-op on non-Windows platforms', () => {
    expect(tightenFileAcl('secrets.json', { platform: 'linux', user: 'me' })).toBe(false)
  })
})
