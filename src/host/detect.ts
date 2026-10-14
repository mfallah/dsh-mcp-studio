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

import { execFile } from 'node:child_process'
import type { RuntimeInfo, RuntimeReport } from '../shared/contract.js'

/** Executables the plugin knows how to launch. */
export const RUNTIME_KEYS = [
  'node',
  'npx',
  'npm',
  'pnpm',
  'bunx',
  'uvx',
  'python',
  'docker',
] as const

export type RuntimeKey = (typeof RUNTIME_KEYS)[number]

/** Default bound for one `--version` call. */
export const DEFAULT_TIMEOUT_MS = 3_000

export interface RuntimeCommandSpec {
  /** Command names to try, in order. Windows variants are added at probe time. */
  candidates: string[]
  versionArgs: string[]
}

export const RUNTIME_COMMANDS: Record<RuntimeKey, RuntimeCommandSpec> = {
  node: { candidates: ['node'], versionArgs: ['--version'] },
  npx: { candidates: ['npx'], versionArgs: ['--version'] },
  npm: { candidates: ['npm'], versionArgs: ['--version'] },
  pnpm: { candidates: ['pnpm'], versionArgs: ['--version'] },
  bunx: { candidates: ['bunx'], versionArgs: ['--version'] },
  uvx: { candidates: ['uvx'], versionArgs: ['--version'] },
  // Windows ships `python`; POSIX usually only has `python3`.
  python: { candidates: ['python', 'python3'], versionArgs: ['--version'] },
  docker: { candidates: ['docker'], versionArgs: ['--version'] },
}

export interface ExecResult {
  ok: boolean
  stdout: string
  stderr: string
  code?: number | null
  error?: string
}

export type CommandRunner = (
  command: string,
  args: string[],
  timeoutMs: number,
) => Promise<ExecResult>

export interface DetectOptions {
  /** Process environment the launcher would see. Reserved for PATH overrides. */
  env?: NodeJS.ProcessEnv
  /** Bound for each `--version` probe. Defaults to {@link DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number
  /** Injected command runner. Tests use this; production uses `execFile`. */
  runner?: CommandRunner
  platform?: NodeJS.Platform
  /** Cache the report for the process. Defaults to true, off for custom runners. */
  cache?: boolean
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
export function wrapCommand(
  command: string,
  args: readonly string[],
  options: { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv } = {},
): { command: string; args: string[] } {
  const platform = options.platform ?? process.platform
  if (platform !== 'win32' || !/\.(cmd|bat)$/i.test(command)) {
    return { command, args: [...args] }
  }
  const env = options.env ?? process.env
  const comspec = env.ComSpec ?? env.COMSPEC ?? 'cmd.exe'
  return { command: comspec, args: ['/d', '/s', '/c', command, ...args] }
}

/**
 * Build the runner used for real probes: `execFile` with a hard timeout that
 * resolves instead of rejecting. `env` supplies `ComSpec` when a `.cmd`
 * candidate needs the interpreter.
 */
export function createDefaultRunner(options: { env?: NodeJS.ProcessEnv } = {}): CommandRunner {
  const env = options.env ?? process.env
  return (command, args, timeoutMs) => {
    const launcher = wrapCommand(command, args, { env })
    return new Promise<ExecResult>((resolve) => {
      execFile(
        launcher.command,
        launcher.args,
        { timeout: timeoutMs, windowsHide: true, maxBuffer: 1 << 20, encoding: 'utf8' },
        (error, stdout, stderr) => {
          resolve({
            ok: !error,
            stdout: typeof stdout === 'string' ? stdout : '',
            stderr: typeof stderr === 'string' ? stderr : '',
            code: error && typeof error.code === 'number' ? error.code : error ? 1 : 0,
            ...(error ? { error: error.message } : {}),
          })
        },
      )
    })
  }
}

/** The process-environment runner, for callers that do not inject one. */
export const defaultRunner: CommandRunner = createDefaultRunner()

/** First non-empty line of `--version` output, trimmed. */
export function parseVersionLine(output: string): string | undefined {
  const line = output
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0)
  return line
}

/**
 * Command names to try on a platform. On Windows an executable is usually
 * `npm.cmd`, and `child_process` does not apply PATHEXT, so the variants are
 * explicit.
 */
export function candidateCommands(
  candidates: readonly string[],
  platform: NodeJS.Platform = process.platform,
): string[] {
  if (platform !== 'win32') return [...candidates]
  const out: string[] = []
  for (const candidate of candidates) {
    for (const variant of [candidate, `${candidate}.cmd`, `${candidate}.exe`, `${candidate}.bat`]) {
      if (!out.includes(variant)) out.push(variant)
    }
  }
  return out
}

async function resolveExecutable(
  command: string,
  runner: CommandRunner,
  timeoutMs: number,
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): Promise<string | undefined> {
  const finder = platform === 'win32' ? 'where.exe' : 'which'
  const launcher = wrapCommand(finder, [command], { platform, env })
  const result = await runner(launcher.command, launcher.args, timeoutMs)
  if (!result.ok) return undefined
  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0)
}

async function probeRuntime(
  key: RuntimeKey,
  options: {
    runner: CommandRunner
    timeoutMs: number
    platform: NodeJS.Platform
    env: NodeJS.ProcessEnv
  },
): Promise<RuntimeInfo> {
  const spec = RUNTIME_COMMANDS[key]
  for (const command of candidateCommands(spec.candidates, options.platform)) {
    const launcher = wrapCommand(command, spec.versionArgs, {
      platform: options.platform,
      env: options.env,
    })
    const result = await options.runner(launcher.command, launcher.args, options.timeoutMs)
    if (!result.ok) continue
    const version =
      parseVersionLine(result.stdout) ?? parseVersionLine(result.stderr)
    const path = await resolveExecutable(
      command,
      options.runner,
      options.timeoutMs,
      options.platform,
      options.env,
    )
    return {
      available: true,
      ...(path !== undefined ? { path } : {}),
      ...(version !== undefined ? { version } : {}),
    }
  }
  return { available: false }
}

const runtimeCache = new Map<string, Promise<RuntimeReport>>()

/** Clear the process-wide runtime cache. Tests call this between cases. */
export function resetRuntimeCache(): void {
  runtimeCache.clear()
}

/**
 * Probe every known runtime in parallel and return a report. Never rejects:
 * a missing or failing executable reports `available: false`.
 */
export async function detectRuntimes(options: DetectOptions = {}): Promise<RuntimeReport> {
  const platform = options.platform ?? process.platform
  const env = options.env ?? process.env
  const runner = options.runner ?? createDefaultRunner({ env })
  const timeoutMs =
    typeof options.timeoutMs === 'number' && options.timeoutMs > 0
      ? options.timeoutMs
      : DEFAULT_TIMEOUT_MS
  const useCache = options.cache ?? options.runner === undefined

  const probe = async (): Promise<RuntimeReport> => {
    const results = await Promise.all(
      RUNTIME_KEYS.map(
        async (key) =>
          [key, await probeRuntime(key, { runner, timeoutMs, platform, env })] as const,
      ),
    )
    const report: RuntimeReport = {}
    for (const [key, info] of results) {
      report[key] = info
    }
    return report
  }

  if (!useCache) return probe()

  const cacheKey = `${platform}:${timeoutMs}`
  const cached = runtimeCache.get(cacheKey)
  if (cached) return cached
  const pending = probe().catch((error: unknown) => {
    runtimeCache.delete(cacheKey)
    throw error
  })
  runtimeCache.set(cacheKey, pending)
  return pending
}
