/**
 * Bounded per-server log ring buffers.
 *
 * Each server keeps the last N entries in memory, numbered with a
 * per-server monotonic `seq`. `tail(serverId, sinceSeq)` returns everything
 * newer than `sinceSeq`, so the client can poll incrementally without ever
 * replaying or missing a line.
 *
 * @module @mfallah/dsh-mcp-studio/host/logs
 */

import type { LogChunk, LogEntry } from '../shared/contract.js'

/** Entries kept per server unless the caller says otherwise. */
export const DEFAULT_MAX_PER_SERVER = 500

/** Longest message stored; anything longer is truncated with an ellipsis. */
export const MAX_MESSAGE_LENGTH = 4_000

/** Collapse newlines and truncate, so one entry stays one bounded line. */
export function normalizeMessage(message: string): string {
  const text = message.replace(/\r\n?|\n/g, ' ').trim()
  return text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH - 1)}…` : text
}

interface ServerLog {
  entries: LogEntry[]
  nextSeq: number
}

export interface LogBufferOptions {
  /** Ring capacity per server. Defaults to {@link DEFAULT_MAX_PER_SERVER}. */
  maxPerServer?: number
  /** Clock used for entry timestamps. Tests inject this. */
  now?: () => Date
}

/** A fixed-capacity ring per server, keyed by server id. */
export class LogBuffer {
  private readonly maxPerServer: number
  private readonly now: () => Date
  private readonly servers = new Map<string, ServerLog>()

  constructor(options: LogBufferOptions = {}) {
    const max = options.maxPerServer ?? DEFAULT_MAX_PER_SERVER
    this.maxPerServer = Number.isFinite(max) && max >= 1 ? Math.floor(max) : DEFAULT_MAX_PER_SERVER
    this.now = options.now ?? (() => new Date())
  }

  private ring(serverId: string): ServerLog {
    let ring = this.servers.get(serverId)
    if (!ring) {
      ring = { entries: [], nextSeq: 1 }
      this.servers.set(serverId, ring)
    }
    return ring
  }

  /** Append one line; the oldest line is dropped once the ring is full. */
  append(serverId: string, level: LogEntry['level'], message: string): LogEntry {
    const ring = this.ring(serverId)
    const entry: LogEntry = {
      seq: ring.nextSeq,
      at: this.now().toISOString(),
      level,
      message: normalizeMessage(message),
    }
    ring.nextSeq += 1
    ring.entries.push(entry)
    if (ring.entries.length > this.maxPerServer) {
      ring.entries.splice(0, ring.entries.length - this.maxPerServer)
    }
    return { ...entry }
  }

  /** Everything newer than `sinceSeq`. `nextSeq` is safe to pass next time. */
  tail(serverId: string, sinceSeq: number): LogChunk {
    const ring = this.ring(serverId)
    const from = Number.isFinite(sinceSeq) ? sinceSeq : 0
    const entries = ring.entries.filter((entry) => entry.seq > from).map((entry) => ({ ...entry }))
    const last = entries[entries.length - 1]
    return {
      serverId,
      entries,
      nextSeq: last ? last.seq : from,
    }
  }

  /** Every retained entry, oldest first. */
  entries(serverId: string): LogEntry[] {
    return this.ring(serverId).entries.map((entry) => ({ ...entry }))
  }

  /** Number of retained entries for one server. */
  size(serverId: string): number {
    return this.ring(serverId).entries.length
  }

  /** Drop the retained entries but keep the sequence counter running. */
  clear(serverId: string): void {
    const ring = this.ring(serverId)
    ring.entries = []
  }

  /** Drop the entries and the sequence counter, for a deleted server. */
  forget(serverId: string): void {
    this.servers.delete(serverId)
  }

  /** Ids that currently have a ring, in insertion order. */
  serverIds(): string[] {
    return [...this.servers.keys()]
  }
}
