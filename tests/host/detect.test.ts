import { describe, expect, it } from 'vitest'
import {
  candidateCommands,
  detectRuntimes,
  parseVersionLine,
  RUNTIME_COMMANDS,
  RUNTIME_KEYS,
  resetRuntimeCache,
  wrapCommand,
  type CommandRunner,
} from '../../src/host/detect.js'

describe('wrapCommand', () => {
  it('leaves POSIX commands alone', () => {
    expect(wrapCommand('npx.cmd', ['--version'], { platform: 'linux' })).toEqual({
      command: 'npx.cmd',
      args: ['--version'],
    })
  })

  it('leaves native Windows executables alone', () => {
    expect(wrapCommand('node.exe', ['--version'], { platform: 'win32' })).toEqual({
      command: 'node.exe',
      args: ['--version'],
    })
    expect(wrapCommand('where.exe', ['node'], { platform: 'win32' })).toEqual({
      command: 'where.exe',
      args: ['node'],
    })
  })

  it('routes .cmd and .bat through the interpreter with separate argv entries', () => {
    const wrapped = wrapCommand('npx.cmd', ['--version'], { platform: 'win32', env: {} })
    expect(wrapped.command).toBe('cmd.exe')
    expect(wrapped.args).toEqual(['/d', '/s', '/c', 'npx.cmd', '--version'])
    // The command and its arguments are never joined into one shell string.
    expect(wrapped.args).toHaveLength(5)
    expect(wrapped.args[4]).toBe('--version')
  })

  it('honors ComSpec from the injected environment', () => {
    const wrapped = wrapCommand('pnpm.bat', ['--version'], {
      platform: 'win32',
      env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
    })
    expect(wrapped.command).toBe('C:\\Windows\\System32\\cmd.exe')
    expect(wrapped.args).toEqual(['/d', '/s', '/c', 'pnpm.bat', '--version'])
  })
})

describe('candidateCommands', () => {
  it('adds Windows executable variants', () => {
    expect(candidateCommands(['npm'], 'win32')).toEqual([
      'npm',
      'npm.cmd',
      'npm.exe',
      'npm.bat',
    ])
  })

  it('uses the bare names on POSIX', () => {
    expect(candidateCommands(['npm'], 'linux')).toEqual(['npm'])
    expect(candidateCommands(RUNTIME_COMMANDS.python.candidates, 'darwin')).toEqual([
      'python',
      'python3',
    ])
  })

  it('covers every runtime key with at least one candidate', () => {
    for (const key of RUNTIME_KEYS) {
      expect(RUNTIME_COMMANDS[key].candidates.length).toBeGreaterThan(0)
      expect(RUNTIME_COMMANDS[key].versionArgs).toEqual(['--version'])
    }
  })
})

describe('parseVersionLine', () => {
  it('takes the first non-empty trimmed line', () => {
    expect(parseVersionLine('\n  v22.11.0  \nmore')).toBe('v22.11.0')
    expect(parseVersionLine('   ')).toBeUndefined()
    expect(parseVersionLine('')).toBeUndefined()
  })
})

function makeRunner(calls: string[]): CommandRunner {
  return async (command, args) => {
    calls.push(`${command} ${args.join(' ')}`.trim())
    if (command === 'where.exe' || command === 'which') {
      return { ok: true, stdout: `/usr/local/bin/${args[0]}\n`, stderr: '' }
    }
    if (command.startsWith('node')) return { ok: true, stdout: 'v22.11.0\n', stderr: '' }
    if (command === 'uvx') return { ok: false, stdout: '', stderr: 'not found' }
    if (command === 'docker') return { ok: true, stdout: '', stderr: 'Docker version 27.0.0\n' }
    if (command.startsWith('python3')) return { ok: true, stdout: 'Python 3.13.1\n', stderr: '' }
    return { ok: false, stdout: '', stderr: 'not found' }
  }
}

describe('detectRuntimes', () => {
  it('reports every known key', async () => {
    const calls: string[] = []
    const report = await detectRuntimes({ runner: makeRunner(calls), platform: 'linux' })

    expect(Object.keys(report).sort()).toEqual([...RUNTIME_KEYS].sort())
    for (const key of RUNTIME_KEYS) expect(report[key]).toBeDefined()
  })

  it('finds a runtime, its path and its version', async () => {
    const calls: string[] = []
    const report = await detectRuntimes({ runner: makeRunner(calls), platform: 'linux' })

    expect(report.node).toEqual({
      available: true,
      path: '/usr/local/bin/node',
      version: 'v22.11.0',
    })
    expect(calls).toContain('which node')
    expect(calls).toContain('node --version')
  })

  it('falls back to the next candidate when the first is missing', async () => {
    const report = await detectRuntimes({ runner: makeRunner([]), platform: 'linux' })
    expect(report.python).toEqual({
      available: true,
      path: '/usr/local/bin/python3',
      version: 'Python 3.13.1',
    })
  })

  it('reports unavailable runtimes without throwing', async () => {
    const report = await detectRuntimes({ runner: makeRunner([]), platform: 'linux' })
    expect(report.uvx).toEqual({ available: false })
    expect(report.bunx).toEqual({ available: false })
  })

  it('reads a version out of stderr when stdout is empty', async () => {
    const report = await detectRuntimes({ runner: makeRunner([]), platform: 'linux' })
    expect(report.docker).toEqual({
      available: true,
      path: '/usr/local/bin/docker',
      version: 'Docker version 27.0.0',
    })
  })

  it('tries the Windows command variants in order', async () => {
    const calls: string[] = []
    await detectRuntimes({ runner: makeRunner(calls), platform: 'win32' })
    expect(calls[0]).toBe('node --version')
    expect(calls).toContain('where.exe node')
  })

  it('launches .cmd candidates through cmd.exe without joining argv', async () => {
    const calls: { command: string; args: string[] }[] = []
    const runner: CommandRunner = async (command, args) => {
      calls.push({ command, args })
      if (command === 'cmd.exe' && args.includes('npx.cmd')) {
        return { ok: true, stdout: '10.9.0\n', stderr: '' }
      }
      if (command === 'where.exe') return { ok: true, stdout: 'C:\\nodejs\\npx.cmd\n', stderr: '' }
      return { ok: false, stdout: '', stderr: '' }
    }

    const report = await detectRuntimes({ runner, platform: 'win32', env: {} })

    expect(report.npx).toEqual({
      available: true,
      path: 'C:\\nodejs\\npx.cmd',
      version: '10.9.0',
    })
    const interpreterCall = calls.find((call) => call.args.includes('npx.cmd'))
    expect(interpreterCall?.command).toBe('cmd.exe')
    expect(interpreterCall?.args).toEqual(['/d', '/s', '/c', 'npx.cmd', '--version'])

    // A native candidate is launched directly, and nothing is ever a joined string.
    expect(calls.some((call) => call.command === 'node' && call.args.join(' ') === '--version')).toBe(
      true,
    )
    for (const call of calls) {
      expect(call.command).not.toContain(' ')
      for (const arg of call.args) expect(arg).not.toMatch(/--version\s/)
    }
  })

  it('does not cache when a custom runner is injected', async () => {
    const calls: string[] = []
    const first = await detectRuntimes({ runner: makeRunner(calls), platform: 'linux' })
    const second = await detectRuntimes({ runner: makeRunner(calls), platform: 'linux' })
    expect(first).toEqual(second)
    expect(calls.filter((call) => call === 'node --version')).toHaveLength(2)
  })

  it('caches the default probe for the session', async () => {
    resetRuntimeCache()
    const calls: string[] = []
    const runner = makeRunner(calls)
    // cache: true forces a cache hit even though a runner is injected, which is
    // what the service does when it only wants one probe per process.
    const first = await detectRuntimes({ runner, platform: 'linux', cache: true })
    const second = await detectRuntimes({ runner, platform: 'linux', cache: true })
    expect(first).toBe(second)
    expect(calls.filter((call) => call === 'node --version')).toHaveLength(1)
    resetRuntimeCache()
  })
})
