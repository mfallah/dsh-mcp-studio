import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MAX_PER_SERVER,
  LogBuffer,
  MAX_MESSAGE_LENGTH,
  normalizeMessage,
} from '../../src/host/logs.js'

function fixedClock(iso: string): () => Date {
  return () => new Date(iso)
}

describe('LogBuffer sequencing', () => {
  it('numbers entries per server from 1', () => {
    const logs = new LogBuffer({ now: fixedClock('2026-01-01T00:00:00.000Z') })
    const first = logs.append('alpha', 'info', 'first')
    const second = logs.append('alpha', 'warn', 'second')

    expect(first.seq).toBe(1)
    expect(second.seq).toBe(2)
    expect(first.at).toBe('2026-01-01T00:00:00.000Z')
    expect(first.level).toBe('info')
  })

  it('keeps an independent sequence per server', () => {
    const logs = new LogBuffer()
    logs.append('alpha', 'info', 'a1')
    logs.append('beta', 'info', 'b1')
    expect(logs.append('alpha', 'info', 'a2').seq).toBe(2)
    expect(logs.append('beta', 'info', 'b2').seq).toBe(2)
    expect(logs.serverIds()).toEqual(['alpha', 'beta'])
  })
})

describe('LogBuffer.tail', () => {
  it('returns everything newer than sinceSeq', () => {
    const logs = new LogBuffer()
    logs.append('alpha', 'info', 'one')
    logs.append('alpha', 'info', 'two')
    logs.append('alpha', 'error', 'three')

    const chunk = logs.tail('alpha', 1)
    expect(chunk.serverId).toBe('alpha')
    expect(chunk.entries.map((entry) => entry.message)).toEqual(['two', 'three'])
    expect(chunk.nextSeq).toBe(3)
  })

  it('repeats sinceSeq when nothing is new', () => {
    const logs = new LogBuffer()
    logs.append('alpha', 'info', 'one')
    const chunk = logs.tail('alpha', 7)
    expect(chunk.entries).toEqual([])
    expect(chunk.nextSeq).toBe(7)
  })

  it('tails an unknown server as an empty chunk', () => {
    const logs = new LogBuffer()
    expect(logs.tail('ghost', 0)).toEqual({ serverId: 'ghost', entries: [], nextSeq: 0 })
  })

  it('returns copies, so callers cannot mutate the ring', () => {
    const logs = new LogBuffer()
    logs.append('alpha', 'info', 'one')
    const [entry] = logs.tail('alpha', 0).entries
    entry!.message = 'mutated'
    expect(logs.entries('alpha')[0]!.message).toBe('one')
  })
})

describe('LogBuffer ring bounds', () => {
  it('drops the oldest entries past the capacity', () => {
    const logs = new LogBuffer({ maxPerServer: 3 })
    for (let index = 1; index <= 5; index += 1) logs.append('alpha', 'info', `line ${index}`)

    expect(logs.size('alpha')).toBe(3)
    expect(logs.entries('alpha').map((entry) => entry.seq)).toEqual([3, 4, 5])
    expect(logs.tail('alpha', 0).entries.map((entry) => entry.message)).toEqual([
      'line 3',
      'line 4',
      'line 5',
    ])
  })

  it('defaults to 500 entries per server', () => {
    const logs = new LogBuffer()
    for (let index = 0; index < DEFAULT_MAX_PER_SERVER + 1; index += 1) {
      logs.append('alpha', 'debug', `line ${index}`)
    }
    expect(logs.size('alpha')).toBe(DEFAULT_MAX_PER_SERVER)
    expect(logs.entries('alpha')[0]!.seq).toBe(2)
  })

  it('clear keeps the sequence counter, forget resets it', () => {
    const logs = new LogBuffer()
    logs.append('alpha', 'info', 'one')
    logs.append('alpha', 'info', 'two')
    logs.clear('alpha')

    expect(logs.entries('alpha')).toEqual([])
    expect(logs.append('alpha', 'info', 'three').seq).toBe(3)

    logs.forget('alpha')
    expect(logs.append('alpha', 'info', 'restart').seq).toBe(1)
    expect(logs.serverIds()).toEqual(['alpha'])
  })
})

describe('normalizeMessage', () => {
  it('collapses newlines into one line', () => {
    expect(normalizeMessage('first\r\nsecond\nthird')).toBe('first second third')
    expect(normalizeMessage('  padded  ')).toBe('padded')
  })

  it('truncates very long messages', () => {
    const long = 'x'.repeat(MAX_MESSAGE_LENGTH + 500)
    const normalized = normalizeMessage(long)
    expect(normalized).toHaveLength(MAX_MESSAGE_LENGTH)
    expect(normalized.endsWith('…')).toBe(true)
  })

  it('applies to appended entries', () => {
    const logs = new LogBuffer()
    const entry = logs.append('alpha', 'error', 'boom\nstack line')
    expect(entry.message).toBe('boom stack line')
  })
})
