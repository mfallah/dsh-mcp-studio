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
import type { LogChunk, LogEntry } from '../shared/contract.js';
/** Entries kept per server unless the caller says otherwise. */
export declare const DEFAULT_MAX_PER_SERVER = 500;
/** Longest message stored; anything longer is truncated with an ellipsis. */
export declare const MAX_MESSAGE_LENGTH = 4000;
/** Collapse newlines and truncate, so one entry stays one bounded line. */
export declare function normalizeMessage(message: string): string;
export interface LogBufferOptions {
    /** Ring capacity per server. Defaults to {@link DEFAULT_MAX_PER_SERVER}. */
    maxPerServer?: number;
    /** Clock used for entry timestamps. Tests inject this. */
    now?: () => Date;
}
/** A fixed-capacity ring per server, keyed by server id. */
export declare class LogBuffer {
    private readonly maxPerServer;
    private readonly now;
    private readonly servers;
    constructor(options?: LogBufferOptions);
    private ring;
    /** Append one line; the oldest line is dropped once the ring is full. */
    append(serverId: string, level: LogEntry['level'], message: string): LogEntry;
    /** Everything newer than `sinceSeq`. `nextSeq` is safe to pass next time. */
    tail(serverId: string, sinceSeq: number): LogChunk;
    /** Every retained entry, oldest first. */
    entries(serverId: string): LogEntry[];
    /** Number of retained entries for one server. */
    size(serverId: string): number;
    /** Drop the retained entries but keep the sequence counter running. */
    clear(serverId: string): void;
    /** Drop the entries and the sequence counter, for a deleted server. */
    forget(serverId: string): void;
    /** Ids that currently have a ring, in insertion order. */
    serverIds(): string[];
}
