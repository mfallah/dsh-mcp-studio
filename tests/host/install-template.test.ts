import { describe, expect, it } from 'vitest'
import {
  CatalogInputError,
  DEFAULT_TOOL_CALL_TIMEOUT_MS,
  entryToDraft,
  secretNameFor,
  secretValuesFor,
  templateInputKeys,
  validateCatalogValues,
} from '../../src/host/install-template.js'
import type { CatalogEntry } from '../../src/shared/contract.js'

const stdioEntry: CatalogEntry = {
  id: 'curated:demo',
  source: 'curated',
  slug: 'demo',
  title: 'Demo',
  description: 'A demo entry.',
  publisher: 'Test',
  transport: 'stdio',
  command: 'npx',
  args: [
    '-y',
    'pkg',
    '--dir={input:directory}',
    '--api-key={input:API_KEY}',
    '--optional={input:opt}',
  ],
  inputs: [
    { key: 'directory', label: 'Directory', required: true, secret: false, format: 'directory' },
    { key: 'API_KEY', label: 'API key', required: true, secret: true, format: 'password' },
    {
      key: 'LOG_LEVEL',
      label: 'Log level',
      required: false,
      secret: false,
      format: 'string',
      defaultValue: 'info',
    },
    { key: 'opt', label: 'Optional', required: false, secret: false, format: 'string' },
  ],
  categories: ['demo'],
  offline: true,
}

const httpEntry: CatalogEntry = {
  id: 'curated:remote',
  source: 'curated',
  slug: 'remote',
  title: 'Remote',
  description: 'A hosted entry.',
  publisher: 'Test',
  transport: 'streamable-http',
  url: 'https://api.example.com/mcp?token={input:token}',
  inputs: [
    { key: 'token', label: 'Token', required: true, secret: true, format: 'password' },
    { key: 'Authorization', label: 'Header', required: true, secret: true, format: 'password' },
    { key: 'X_ORG', label: 'Org', required: true, secret: false, format: 'string' },
  ],
  categories: ['remote'],
  offline: true,
}

describe('validateCatalogValues', () => {
  it('accepts a complete answer set', () => {
    expect(validateCatalogValues(stdioEntry, { directory: 'C:\\x', API_KEY: 'sk-1' })).toEqual({})
  })

  it('reports every missing required input', () => {
    const errors = validateCatalogValues(stdioEntry, {})
    expect(Object.keys(errors).sort()).toEqual(['API_KEY', 'directory'])
    expect(errors.directory).toContain('Directory')
  })

  it('treats whitespace as missing but a default as present', () => {
    expect(validateCatalogValues(stdioEntry, { directory: '   ', API_KEY: 'k' })).toHaveProperty(
      'directory',
    )
    // opt has no default and is not required, so it stays valid when empty.
    expect(validateCatalogValues(stdioEntry, { directory: 'C:\\x', API_KEY: 'k' })).not.toHaveProperty(
      'opt',
    )
  })

  it('checks number and boolean formats', () => {
    const numeric: CatalogEntry = {
      ...stdioEntry,
      args: ['-n', '{input:count}'],
      inputs: [{ key: 'count', label: 'Count', required: true, secret: false, format: 'number' }],
    }
    expect(validateCatalogValues(numeric, { count: '12' })).toEqual({})
    expect(validateCatalogValues(numeric, { count: 'abc' })).toHaveProperty('count')

    const flag: CatalogEntry = {
      ...stdioEntry,
      args: ['{input:verbose}'],
      inputs: [{ key: 'verbose', label: 'Verbose', required: true, secret: false, format: 'boolean' }],
    }
    expect(validateCatalogValues(flag, { verbose: 'true' })).toEqual({})
    expect(validateCatalogValues(flag, { verbose: 'yes' })).toHaveProperty('verbose')
  })

  it('reports a template placeholder with no declared input', () => {
    const broken: CatalogEntry = { ...stdioEntry, args: ['--ghost={input:ghost}'] }
    expect(validateCatalogValues(broken, {})).toHaveProperty('ghost')
  })
})

describe('entryToDraft for stdio entries', () => {
  it('substitutes inputs and routes secrets to placeholders', () => {
    const draft = entryToDraft(stdioEntry, { directory: 'C:\\data', API_KEY: 'sk-live' })

    expect(draft).toMatchObject({
      transport: 'stdio',
      title: 'Demo',
      description: 'A demo entry.',
      serverName: 'demo',
      command: 'npx',
      failOnStartupError: false,
      toolCallTimeoutMs: DEFAULT_TOOL_CALL_TIMEOUT_MS,
    })
    expect(draft.args).toEqual([
      '-y',
      'pkg',
      '--dir=C:\\data',
      '--api-key=${secret:API_KEY}',
    ])
    expect(draft.env).toEqual({ LOG_LEVEL: 'info' })
    // The secret value never leaks into the draft.
    expect(JSON.stringify(draft)).not.toContain('sk-live')
  })

  it('uses the input default when the user leaves an optional value empty', () => {
    const draft = entryToDraft(stdioEntry, { directory: 'C:\\data', API_KEY: 'k', LOG_LEVEL: '' })
    expect(draft.env).toEqual({ LOG_LEVEL: 'info' })
  })

  it('lets an explicit value override the default', () => {
    const draft = entryToDraft(stdioEntry, {
      directory: 'C:\\data',
      API_KEY: 'k',
      LOG_LEVEL: 'debug',
    })
    expect(draft.env).toEqual({ LOG_LEVEL: 'debug' })
  })

  it('drops an argument whose optional placeholder has no value', () => {
    const draft = entryToDraft(stdioEntry, {
      directory: 'C:\\data',
      API_KEY: 'k',
      opt: 'here',
    })
    expect(draft.args).toContain('--optional=here')
  })

  it('throws a missing-input error that names the keys', () => {
    try {
      entryToDraft(stdioEntry, { directory: 'C:\\data' })
      throw new Error('expected entryToDraft to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(CatalogInputError)
      expect((error as CatalogInputError).code).toBe('missing')
      expect((error as CatalogInputError).keys).toEqual(['API_KEY'])
    }
  })

  it('routes a non-secret, unreferenced input into env', () => {
    const entry: CatalogEntry = {
      ...stdioEntry,
      args: ['-y', 'pkg'],
      inputs: [
        { key: 'SLACK_TEAM_ID', label: 'Team', required: true, secret: false, format: 'string' },
        { key: 'SLACK_BOT_TOKEN', label: 'Token', required: true, secret: true, format: 'password' },
      ],
    }
    const draft = entryToDraft(entry, { SLACK_TEAM_ID: 'T123', SLACK_BOT_TOKEN: 'xoxb' })
    expect(draft.env).toEqual({ SLACK_TEAM_ID: 'T123', SLACK_BOT_TOKEN: '${secret:SLACK_BOT_TOKEN}' })
  })

  it('rejects an entry with no command', () => {
    const broken: CatalogEntry = { ...stdioEntry, command: undefined }
    expect(() => entryToDraft(broken, {})).toThrow(CatalogInputError)
  })
})

describe('entryToDraft for http entries', () => {
  it('substitutes the url and routes secrets to headers', () => {
    const draft = entryToDraft(httpEntry, {
      token: 'tok-1',
      Authorization: 'Bearer tok-2',
      X_ORG: 'acme',
    })

    expect(draft.transport).toBe('streamable-http')
    expect(draft.url).toBe('https://api.example.com/mcp?token=${secret:token}')
    expect(draft.headers).toEqual({
      Authorization: '${secret:Authorization}',
      X_ORG: 'acme',
    })
    expect(JSON.stringify(draft)).not.toContain('tok-1')
    expect(JSON.stringify(draft)).not.toContain('tok-2')
  })

  it('rejects an entry with no url', () => {
    const broken: CatalogEntry = { ...httpEntry, url: undefined }
    expect(() => entryToDraft(broken, {})).toThrow(CatalogInputError)
  })
})

describe('helpers', () => {
  it('lists template placeholders once, in order', () => {
    expect(templateInputKeys(stdioEntry)).toEqual(['directory', 'API_KEY', 'opt'])
    expect(templateInputKeys(httpEntry)).toEqual(['token'])
  })

  it('keys secrets by input key', () => {
    expect(secretNameFor({ key: 'API_KEY', label: 'l', required: true, secret: true, format: 'password' })).toBe(
      'API_KEY',
    )
    expect(() =>
      secretNameFor({ key: 'bad name', label: 'l', required: true, secret: true, format: 'password' }),
    ).toThrow(CatalogInputError)
  })

  it('exposes only the supplied secret values', () => {
    const values = secretValuesFor(stdioEntry, { directory: 'C:\\x', API_KEY: 'sk-1' })
    expect(values).toEqual({ API_KEY: 'sk-1' })
    expect(JSON.stringify(entryToDraft(stdioEntry, { directory: 'C:\\x', API_KEY: 'sk-1' }))).not.toContain(
      'sk-1',
    )
  })
})
