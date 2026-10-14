/**
 * Build script for @mfallah/dsh-mcp-studio.
 *
 * Produces three artifacts consumed by the harness:
 *
 *   lib/index.js          host half — a plain ESM Cordis plugin module.
 *   lib/client.js         client half — a browser module registered through
 *                         `window.__ModuleLoader__.load({ id, factory })`,
 *                         the envelope the DSH web shell uses for every
 *                         client plugin bundle.
 *   lib/types/**          `.d.ts` files emitted by tsc, for consumers.
 *
 * Host and client share code under `src/shared/`; both bundles inline it.
 * Every `@deepseek-ai/*` package, React and zod stay external, because the
 * harness supplies them from its own module table.
 *
 * Usage: node build.mjs [--watch]
 */
import { build, context } from 'esbuild'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

const watch = process.argv.includes('--watch')

/**
 * Shared externals. `@deepseek-ai/*` covers both host services and the client
 * module table; a wildcard external keeps the bundles small and guarantees a
 * single React instance in the page.
 */
const externals = [
  '@deepseek-ai/*',
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  'zod',
]

/** Host half: node ESM, no bundling of dependencies. */
const hostOptions = {
  entryPoints: [join(root, 'src/host/index.ts')],
  outfile: join(root, 'lib/index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  logLevel: 'info',
  external: externals,
  banner: { js: `/* ${pkg.name} host half v${pkg.version} */` },
}

/**
 * Client half, compiled to a CommonJS factory first and then wrapped in the
 * module-loader envelope the web shell expects. The wrapper is generated here
 * rather than by a plugin so the exact envelope stays visible and reviewable.
 */
function wrapClient(code) {
  return `window.__ModuleLoader__.load({
  id: ${JSON.stringify(pkg.name)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${code
  .split('\n')
  .map((line) => (line.length > 0 ? `    ${line}` : line))
  .join('\n')}
    return module.exports;
  },
});
`
}

const clientOptions = {
  entryPoints: [join(root, 'src/client/index.ts')],
  outfile: join(root, 'lib/client.raw.cjs'),
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  sourcemap: false,
  logLevel: 'info',
  external: externals,
  define: { 'process.env.NODE_ENV': '"production"' },
}

/**
 * Emit `.d.ts` files with the project's own TypeScript.
 *
 * Runs `node node_modules/typescript/bin/tsc` rather than `npx tsc`. Since the
 * CVE-2024-27980 fix, Node refuses to `spawn` a `.cmd` shim without a shell, and
 * `npx` is `npx.cmd` on Windows — so `npx tsc` fails there with `EINVAL`.
 * Invoking the compiler's JS entry point with the current Node binary works
 * everywhere and needs no shell.
 */
function emitTypes() {
  const require = createRequire(import.meta.url)
  let tsc
  try {
    // `require.resolve('typescript')` yields lib/typescript.js.
    tsc = join(dirname(require.resolve('typescript')), '..', 'bin', 'tsc')
  } catch (error) {
    console.error('[build] typescript is not installed; run pnpm install')
    process.exitCode = 1
    return
  }
  try {
    execFileSync(process.execPath, [tsc, '--emitDeclarationOnly'], { cwd: root, stdio: 'inherit' })
  } catch (error) {
    console.error('[build] tsc failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

function finishClient() {
  const raw = readFileSync(join(root, 'lib/client.raw.cjs'), 'utf8')
  writeFileSync(join(root, 'lib/client.js'), wrapClient(raw), 'utf8')
  rmSync(join(root, 'lib/client.raw.cjs'))
}

mkdirSync(join(root, 'lib'), { recursive: true })

if (watch) {
  const hostCtx = await context(hostOptions)
  const clientCtx = await context(clientOptions)
  await hostCtx.watch()
  await clientCtx.watch()
  console.log('[build] watching host + client')
} else {
  await build(hostOptions)
  await build(clientOptions)
  finishClient()
  emitTypes()
  console.log(`[build] ${pkg.name} v${pkg.version} -> lib/`)
}
