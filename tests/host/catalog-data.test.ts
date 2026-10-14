import { describe, expect, it } from 'vitest'
import { CURATED_CATALOG, curatedBySlug, curatedCatalog } from '../../src/host/catalog-data.js'
import { dedupeKey } from '../../src/host/catalog.js'
import { entryToDraft, templateInputKeys } from '../../src/host/install-template.js'

const NPM_OR_UVX = new Set(['npx', 'uvx'])
const FORMATS = new Set(['string', 'number', 'boolean', 'file', 'directory', 'password'])

describe('curated catalog shape', () => {
  it('ships at least 24 entries', () => {
    expect(CURATED_CATALOG.length).toBeGreaterThanOrEqual(24)
  })

  it('uses stable, unique, prefixed ids', () => {
    const ids = CURATED_CATALOG.map((entry) => entry.id)
    const slugs = CURATED_CATALOG.map((entry) => entry.slug)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const entry of CURATED_CATALOG) {
      expect(entry.id).toBe(`curated:${entry.slug}`)
      expect(entry.source).toBe('curated')
      expect(entry.offline).toBe(true)
    }
  })

  it('never launches the same command twice', () => {
    const keys = CURATED_CATALOG.map((entry) => dedupeKey(entry))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('fills the fields the client renders', () => {
    for (const entry of CURATED_CATALOG) {
      expect(entry.title.trim().length).toBeGreaterThan(0)
      expect(entry.description.trim().length).toBeGreaterThan(0)
      expect(entry.publisher.trim().length).toBeGreaterThan(0)
      expect(entry.homepage).toMatch(/^https:\/\//)
      expect(entry.categories.length).toBeGreaterThan(0)
      expect(entry.glyph?.length).toBeTruthy()
      expect(entry.version === undefined || typeof entry.version === 'string').toBe(true)
    }
  })

  it('lowercases every category and tags each entry with its own slug', () => {
    for (const entry of CURATED_CATALOG) {
      for (const category of entry.categories) {
        expect(category).toBe(category.toLowerCase())
        expect(category).not.toMatch(/\s/)
      }
      expect(entry.categories).toContain(entry.slug)
    }
  })

  it('is installable with npx -y or uvx today', () => {
    for (const entry of CURATED_CATALOG) {
      if (entry.transport === 'stdio') {
        expect(NPM_OR_UVX.has(entry.command ?? '')).toBe(true)
        expect(Array.isArray(entry.args)).toBe(true)
        if (entry.command === 'npx') expect(entry.args?.[0]).toBe('-y')
      } else {
        expect(entry.url).toMatch(/^https:\/\//)
      }
    }
  })
})

describe('curated catalog inputs', () => {
  it('declares well formed inputs', () => {
    for (const entry of CURATED_CATALOG) {
      const keys = entry.inputs.map((input) => input.key)
      expect(new Set(keys).size).toBe(keys.length)
      for (const input of entry.inputs) {
        expect(input.key).toMatch(/^[A-Za-z0-9._-]{1,64}$/)
        expect(input.label.trim().length).toBeGreaterThan(0)
        expect(FORMATS.has(input.format)).toBe(true)
        expect(typeof input.required).toBe('boolean')
        expect(typeof input.secret).toBe('boolean')
        if (input.secret) expect(input.format).toBe('password')
        expect(input.description ?? '').not.toMatch(/^$/)
      }
    }
  })

  it('only references declared inputs from a template', () => {
    for (const entry of CURATED_CATALOG) {
      const declared = new Set(entry.inputs.map((input) => input.key))
      for (const key of templateInputKeys(entry)) {
        expect(declared.has(key)).toBe(true)
      }
    }
  })

  it('converts every entry into a draft from minimal answers', () => {
    for (const entry of CURATED_CATALOG) {
      const answers: Record<string, string> = {}
      for (const input of entry.inputs) {
        if (input.defaultValue !== undefined) continue
        answers[input.key] = input.format === 'number' ? '1' : 'x'
      }
      const draft = entryToDraft(entry, answers)
      expect(draft.transport).toBe(entry.transport)
      expect(draft.title).toBe(entry.title)
      expect(draft.serverName).toMatch(/^[A-Za-z0-9_-]{1,32}$/)
      if (draft.transport === 'stdio') expect(draft.command).toBeTruthy()
      else expect(draft.url).toMatch(/^https:\/\//)
    }
  })

  it('never puts a secret value into a draft', () => {
    for (const entry of CURATED_CATALOG) {
      const answers: Record<string, string> = {}
      for (const input of entry.inputs) {
        answers[input.key] = `SECRET-${input.key}-VALUE`
      }
      const draft = entryToDraft(entry, answers)
      const serialized = JSON.stringify(draft)
      for (const input of entry.inputs) {
        if (input.secret) expect(serialized).not.toContain(`SECRET-${input.key}-VALUE`)
      }
    }
  })
})

describe('curated catalog content spot checks', () => {
  it('carries the reference servers with verified package names', () => {
    expect(curatedBySlug('filesystem')?.args).toEqual([
      '-y',
      '@modelcontextprotocol/server-filesystem',
      '{input:directory}',
    ])
    expect(curatedBySlug('memory')?.args).toEqual(['-y', '@modelcontextprotocol/server-memory'])
    expect(curatedBySlug('git')?.command).toBe('uvx')
    expect(curatedBySlug('fetch')?.args).toEqual(['mcp-server-fetch'])
    expect(curatedBySlug('playwright')?.args).toEqual(['-y', '@playwright/mcp@latest'])
  })

  it('uses the hosted GitHub server over Streamable HTTP', () => {
    const github = curatedBySlug('github')
    expect(github?.transport).toBe('streamable-http')
    expect(github?.url).toBe('https://api.githubcopilot.com/mcp/')
    expect(github?.inputs.map((input) => input.key)).toEqual(['Authorization'])
  })

  it('returns defensive copies', () => {
    const first = curatedCatalog()
    first[0]!.title = 'mutated'
    expect(CURATED_CATALOG[0]!.title).not.toBe('mutated')
    expect(curatedBySlug('filesystem')?.title).toBe('Filesystem')
    expect(curatedBySlug('nope')).toBeUndefined()
  })
})
