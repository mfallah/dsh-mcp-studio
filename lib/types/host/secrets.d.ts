/**
 * Secret value store.
 *
 * Values live in `<storeDir>/secrets.json` beside the server list, never in
 * `servers.json` and never in an event or a log line. The only API that can
 * return a value is {@link SecretStore.get}; everything else exposes names.
 * On Windows the file's ACL is tightened to the current user best-effort after
 * every write, because the default inheritance on a profile directory usually
 * grants more than the file needs.
 *
 * @module @mfallah/dsh-mcp-studio/host/secrets
 */
import { type ServerConfig } from '../shared/contract.js';
import { type StoreInit } from './store.js';
/** File name inside the store directory. */
export declare const SECRETS_FILE = "secrets.json";
/** Names accepted by {@link SecretStore.set}, matching the placeholder grammar. */
export declare const SECRET_NAME_RE: RegExp;
/** On-disk shape of `secrets.json`. */
export interface SecretsFile {
    version: number;
    secrets: Record<string, string>;
}
export interface SecretStoreOptions {
    /** Store directory, resolved by the service from plugin config. */
    dir: string;
    /**
     * Tighten the file ACL to the current user on Windows. Defaults to true;
     * tests turn it off. Ignored on other platforms.
     */
    tightenAcl?: boolean;
    /** Clock used for quarantine file names. Tests inject this. */
    now?: () => Date;
}
/**
 * `icacls` arguments that strip inheritance and grant only `user` access.
 * Pure, so the command shape is testable without touching a file.
 */
export declare function icaclsArgs(file: string, user: string): string[];
/**
 * Best-effort ACL tightening. Every failure is swallowed: a lock-down that
 * does not work must not stop the plugin from storing a secret.
 */
export declare function tightenFileAcl(file: string, options?: {
    platform?: NodeJS.Platform;
    user?: string;
    quiet?: boolean;
}): boolean;
/** Validate a secret name against the placeholder grammar. */
export declare function assertSecretName(name: string): string;
/** Parse `secrets.json`; throws a `corrupt` {@link StoreError} on bad input. */
export declare function parseSecretsFile(raw: string): Record<string, string>;
/** Serialize a secret record into the current envelope. */
export declare function serializeSecretsFile(secrets: Readonly<Record<string, string>>): string;
/** Names of every secret referenced by a server config's env/headers. */
export declare function secretRefsIn(config: ServerConfig): string[];
/**
 * The secret value store. Values never leave through anything but `get()`.
 */
export declare class SecretStore {
    readonly dir: string;
    readonly file: string;
    private readonly tightenAcl;
    private readonly now;
    private cache;
    private warnings;
    constructor(options: SecretStoreOptions);
    /** Create the store directory, load the file, quarantine a corrupt one. */
    init(): Promise<StoreInit>;
    private readFromDisk;
    private loaded;
    private applyAcl;
    private persist;
    /** Secret names, sorted. Values are never included. */
    names(): string[];
    /** The value of one secret, or undefined when it is not stored. */
    get(name: string): string | undefined;
    has(name: string): boolean;
    /** Store or replace one secret value. */
    set(name: string, value: string): Promise<void>;
    /** Delete one secret. Deleting an unknown name is a no-op. */
    delete(name: string): Promise<void>;
    /**
     * Resolve a `${secret:NAME}` placeholder, or a bare name, to its value.
     * Returns undefined when the name is unknown.
     */
    resolve(ref: string): string | undefined;
}
