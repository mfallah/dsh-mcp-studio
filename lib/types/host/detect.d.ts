/**
 * Local runtime detection.
 *
 * The UI needs to know which launchers exist before it offers an install —
 * `npx` for npm-packaged servers, `uvx` for PyPI ones, `docker` for images.
 * Every executable is probed once with a bounded `--version` call; probes run
 * in parallel and never throw. {@link detectRuntimes} caches the result for
 * the session unless a custom runner is injected (tests) or `cache: false`.
 *
 * @module @mfallah/dsh-mcp-studio/host/detect
 */
import type { RuntimeReport } from '../shared/contract.js';
/** Executables the plugin knows how to launch. */
export declare const RUNTIME_KEYS: readonly ["node", "npx", "npm", "pnpm", "bunx", "uvx", "python", "docker"];
export type RuntimeKey = (typeof RUNTIME_KEYS)[number];
/** Default bound for one `--version` call. */
export declare const DEFAULT_TIMEOUT_MS = 3000;
export interface RuntimeCommandSpec {
    /** Command names to try, in order. Windows variants are added at probe time. */
    candidates: string[];
    versionArgs: string[];
}
export declare const RUNTIME_COMMANDS: Record<RuntimeKey, RuntimeCommandSpec>;
export interface ExecResult {
    ok: boolean;
    stdout: string;
    stderr: string;
    code?: number | null;
    error?: string;
}
export type CommandRunner = (command: string, args: string[], timeoutMs: number) => Promise<ExecResult>;
export interface DetectOptions {
    /** Process environment the launcher would see. Reserved for PATH overrides. */
    env?: NodeJS.ProcessEnv;
    /** Bound for each `--version` probe. Defaults to {@link DEFAULT_TIMEOUT_MS}. */
    timeoutMs?: number;
    /** Injected command runner. Tests use this; production uses `execFile`. */
    runner?: CommandRunner;
    platform?: NodeJS.Platform;
    /** Cache the report for the process. Defaults to true, off for custom runners. */
    cache?: boolean;
}
/**
 * Run one command with a hard timeout; resolves instead of rejecting.
 *
 * On Windows the Node child-process API refuses to launch a `.cmd`/`.bat` file
 * directly (the CVE-2024-27980 fix throws `EINVAL`), so those candidates go
 * through the command interpreter with the command and its arguments as
 * separate argv entries — never as one joined string. Only literals from
 * {@link RUNTIME_COMMANDS} or paths returned by `where.exe` reach this path,
 * never a user-supplied string.
 */
export declare function wrapCommand(command: string, args: readonly string[], options?: {
    platform?: NodeJS.Platform;
    env?: NodeJS.ProcessEnv;
}): {
    command: string;
    args: string[];
};
/**
 * Build the runner used for real probes: `execFile` with a hard timeout that
 * resolves instead of rejecting. `env` supplies `ComSpec` when a `.cmd`
 * candidate needs the interpreter.
 */
export declare function createDefaultRunner(options?: {
    env?: NodeJS.ProcessEnv;
}): CommandRunner;
/** The process-environment runner, for callers that do not inject one. */
export declare const defaultRunner: CommandRunner;
/** First non-empty line of `--version` output, trimmed. */
export declare function parseVersionLine(output: string): string | undefined;
/**
 * Command names to try on a platform. On Windows an executable is usually
 * `npm.cmd`, and `child_process` does not apply PATHEXT, so the variants are
 * explicit.
 */
export declare function candidateCommands(candidates: readonly string[], platform?: NodeJS.Platform): string[];
/** Clear the process-wide runtime cache. Tests call this between cases. */
export declare function resetRuntimeCache(): void;
/**
 * Probe every known runtime in parallel and return a report. Never rejects:
 * a missing or failing executable reports `available: false`.
 */
export declare function detectRuntimes(options?: DetectOptions): Promise<RuntimeReport>;
