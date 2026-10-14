/**
 * Draft helpers: the manual form's secret convention and the catalog form's
 * required-input gate. Catalog templating itself lives on the host.
 */
import { describe, expect, it } from 'vitest'
import {
  catalogInputsSatisfied,
  configMapKeys,
  recordToRows,
  rowsToRecord,
  sealSecretRows,
  sealedCatalogValues,
  secretInputWrites,
  secretNameFor,
  transportLabel,
} from '../../src/client/panel/draft.js'
import { createKeyValueRow } from '../../src/client/panel/parts/Editors.js'
import { makeEntry } from './fake-api.js'

describe('secretNameFor', () => {
  it('produces a name inside the secret-name grammar', () => {
    const name = secretNameFor('my server!', 'API KEY')
    expect(name).toMatch(/^[A-Za-z0-9._-]{1,64}$/)
    expect(name).toBe('my_server_.API_KEY')
  })

  it('never exceeds 64 characters and never ends up empty', () => {
    expect(secretNameFor('x'.repeat(80), 'y'.repeat(80)).length).toBeLessThanOrEqual(64)
    expect(secretNameFor('!!!', '???')).toHaveLength(6)
  })
})

describe('catalogInputsSatisfied', () => {
  const entry = makeEntry({
    inputs: [
      { key: 'root', label: 'Root', required: true, secret: false, format: 'directory' },
      { key: 'token', label: 'Token', required: true, secret: true, format: 'password' },
      { key: 'name', label: 'Name', required: false, secret: false, format: 'string' },
    ],
  })

  it('requires every required input to be filled', () => {
    expect(catalogInputsSatisfied(entry, {})).toBe(false)
    expect(catalogInputsSatisfied(entry, { root: '/tmp' })).toBe(false)
    expect(catalogInputsSatisfied(entry, { root: '/tmp', token: 'abc' })).toBe(true)
  })

  it('counts a defaultValue as filled', () => {
    const withDefault = makeEntry({
      inputs: [{ key: 'root', label: 'Root', required: true, secret: false, format: 'string', defaultValue: '/srv' }],
    })
    expect(catalogInputsSatisfied(withDefault, {})).toBe(true)
  })
})

describe('key/value rows', () => {
  it('turns a secret row into a placeholder and keeps the value out of the record', () => {
    const row = { ...createKeyValueRow(), key: 'API_KEY', value: 'hunter2', secret: true }
    const plain = { ...createKeyValueRow(), key: 'REGION', value: 'eu', secret: false }

    const { record, secrets } = rowsToRecord([row, plain], 'myserver')

    expect(record.API_KEY).toBe('${secret:myserver.API_KEY}')
    expect(record.REGION).toBe('eu')
    expect(Object.values(record)).not.toContain('hunter2')
    expect(secrets).toEqual([{ name: 'myserver.API_KEY', value: 'hunter2' }])
  })

  it('drops rows without a key', () => {
    const { record, secrets } = rowsToRecord([{ ...createKeyValueRow(), key: '  ', value: 'x' }], 'p')
    expect(record).toEqual({})
    expect(secrets).toEqual([])
  })

  it('round-trips a record and flags secret references', () => {
    let seq = 0
    const rows = recordToRows({ TOKEN: '${secret:p.TOKEN}', REGION: 'eu' }, () => `r${(seq += 1)}`)
    expect(rows).toHaveLength(2)
    expect(rows[0]?.key).toBe('TOKEN')
    expect(rows[0]?.secret).toBe(true)
    expect(rows[1]?.secret).toBe(false)
  })
})

describe('catalog secret answers', () => {
  const entry = makeEntry({
    inputs: [
      { key: 'root', label: 'Root', required: true, secret: false, format: 'directory' },
      { key: 'token', label: 'Token', required: true, secret: true, format: 'password' },
      { key: 'alt', label: 'Alt', required: false, secret: true, format: 'password' },
    ],
  })

  it('collects one write per non-empty secret answer, named by input key', () => {
    expect(secretInputWrites(entry, { root: '/tmp', token: 'hunter2' })).toEqual([
      { name: 'token', value: 'hunter2' },
    ])
    expect(secretInputWrites(entry, { root: '/tmp' })).toEqual([])
    expect(secretInputWrites(entry, { root: '/tmp', token: '  spaced  ', alt: 'second' })).toEqual([
      { name: 'token', value: 'spaced' },
      { name: 'alt', value: 'second' },
    ])
  })

  it('never re-writes a value that is already a secret reference', () => {
    expect(secretInputWrites(entry, { token: '${secret:token}' })).toEqual([])
    expect(secretInputWrites(entry, { token: '${secret:other}' })).toEqual([])
  })

  it('seals raw answers into their references and leaves literals alone', () => {
    const sealed = sealedCatalogValues(entry, { root: '/tmp', token: 'hunter2' })
    expect(sealed.token).toBe('${secret:token}')
    expect(sealed.root).toBe('/tmp')
    expect(JSON.stringify(sealed)).not.toContain('hunter2')
    // Sealing is idempotent, so a second Test does not rewrite the secret.
    expect(sealedCatalogValues(entry, sealed)).toEqual(sealed)
    expect(secretInputWrites(entry, sealed)).toEqual([])
  })

  it('seals only the rows whose value was actually stored', () => {
    const rows = [
      { ...createKeyValueRow(), key: 'TOKEN', value: 'hunter2', secret: true },
      { ...createKeyValueRow(), key: 'OTHER', value: 'plain', secret: true },
    ]
    const sealed = sealSecretRows(rows, 'server', new Set(['server.TOKEN']))
    expect(sealed[0]?.value).toBe('${secret:server.TOKEN}')
    expect(sealed[0]?.secret).toBe(false)
    expect(sealed[1]?.value).toBe('plain')
    expect(sealed[1]?.secret).toBe(true)
    expect(JSON.stringify(sealed)).not.toContain('hunter2')
  })
})

describe('small descriptors', () => {
  it('names the map a config carries and its transport label', () => {
    expect(
      configMapKeys({ transport: 'stdio', command: 'npx', args: [], env: { A: '1' } } as never),
    ).toEqual(['A'])
    expect(transportLabel('stdio')).toBe('catalogTransportStdio')
    expect(transportLabel('streamable-http')).toBe('catalogTransportHttp')
  })
})
