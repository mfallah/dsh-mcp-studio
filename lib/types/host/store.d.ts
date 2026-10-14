/**
 * Atomic JSON persistence for the installed-server list.
 *
 * One file holds every {@link ServerConfig}. Writes go through a temp file in
 * the same directory followed by a rename, so a crash can never leave a
 * half-written `servers.json` behind. Reads validate every entry; a file that
 * does not parse or does not validate is moved aside rather than deleted, and
 * `init()` reports that as a warning instead of taking the plugin down.
 *
 * @module @mfallah/dsh-mcp-studio/host/store
 */
import { type ServerConfig } from '../shared/contract.js';
/** File name inside the store directory. */
export declare const SERVERS_FILE = "servers.json";
/** On-disk shape of `servers.json`. */
export interface ServersFile {
    version: number;
    servers: ServerConfig[];
}
/** Result of {@link ServerStore.init} / {@link SecretStore.init}. */
export interface StoreInit {
    /** Non-fatal problems: a quarantined file, an ignored bad entry, ... */
    warnings: string[];
}
export type StoreErrorCode = 'corrupt' | 'version' | 'invalid' | 'duplicate-id' | 'duplicate-server-name' | 'not-found';
/** Every failure from this module is one of these, with a stable `code`. */
export declare class StoreError extends Error {
    readonly code: StoreErrorCode;
    /** Quarantine path when a corrupt file was moved aside. */
    readonly quarantinePath?: string;
    readonly path?: string;
    constructor(code: StoreErrorCode, message: string, options?: {
        path?: string;
        quarantinePath?: string;
        cause?: unknown;
    });
}
/**
 * Default store directory: `$DSH_HOME/mcp-studio`, where `DSH_HOME` defaults
 * to `~/.dsh`. The service resolves the directory from plugin config and
 * passes it in; this helper exists for that default only.
 */
export declare function defaultStoreDir(env?: NodeJS.ProcessEnv, homeDirectory?: string): string;
/**
 * Validate one persisted server config and rebuild it with exactly the fields
 * the contract knows, so unknown keys never survive a round-trip.
 */
export declare function validateServerConfig(value: unknown, at?: string): ServerConfig;
/** Validate a whole list, rejecting duplicate ids and server names. */
export declare function validateServerConfigs(value: unknown, at?: string): ServerConfig[];
/**
 * Parse the contents of `servers.json`. Accepts the current `{version,
 * servers}` envelope and a bare array (the shape written before the envelope
 * existed).
 */
export declare function parseServersFile(raw: string): ServerConfig[];
/** Serialize a server list into the current envelope. */
export declare function serializeServersFile(servers: readonly ServerConfig[]): string;
/**
 * Write `contents` to `file` atomically: write a sibling temp file, then
 * rename over the destination.
 */
export declare function writeFileAtomic(file: string, contents: string): void;
/**
 * Move a corrupt file aside so the store can start empty without destroying
 * the evidence. Returns the path it was moved to.
 */
export declare function quarantineFile(file: string, now?: Date, label?: string): string;
export interface ServerStoreOptions {
    /** Store directory, resolved by the service from plugin config. */
    dir: string;
    /** Process environment, kept for future path expansion. */
    env?: NodeJS.ProcessEnv;
    /** Clock used for quarantine file names. Tests inject this. */
    now?: () => Date;
    /**
     * Move a corrupt file aside instead of leaving it in place. Defaults to
     * true; `init()` surfaces the move as a warning.
     */
    quarantineOnCorrupt?: boolean;
}
/**
 * The `servers.json` store: in-memory CRUD with an atomic write after every
 * mutation. `init()` must run before first use.
 */
export declare class ServerStore {
    readonly dir: string;
    readonly env: NodeJS.ProcessEnv;
    readonly file: string;
    private readonly now;
    private readonly quarantineOnCorrupt;
    private cache;
    private warnings;
    constructor(options: ServerStoreOptions);
    /**
     * Create the store directory if missing and load `servers.json`. A corrupt
     * or unreadable file is moved aside and reported in `warnings`; `init()`
     * itself does not throw for that.
     */
    init(): Promise<StoreInit>;
    private readFromDisk;
    /** Lazily load when a read happens before `init()`. */
    private loaded;
    private persist;
    /** Drop the in-memory cache; the next read hits the disk again. */
    reload(): void;
    list(): ServerConfig[];
    get(id: string): ServerConfig | undefined;
    findByName(serverName: string): ServerConfig | undefined;
    /**
     * Insert or replace by `id`. Throws when another entry already uses the
     * incoming `serverName`.
     */
    upsert(config: ServerConfig): Promise<void>;
    /** Remove a server by id. Removing an unknown id is a no-op. */
    remove(id: string): Promise<void>;
    /** Replace the whole list, validating and persisting it. */
    replaceAll(configs: readonly ServerConfig[]): Promise<void>;
}
