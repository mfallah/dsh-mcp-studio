#!/usr/bin/env node
/**
 * Fail when a user-facing document still carries a placeholder that was meant to
 * be filled in before release.
 *
 * A line is exempt when it ends with the marker `<!-- docs-check: allow -->`,
 * which is how the intentionally empty screenshot frame in README.md stays.
 *
 * Usage: node scripts/check-docs.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const files = [
  'README.md',
  'CHANGELOG.md',
  'AGENTS.md',
  'docs/INSTALL.md',
  'docs/USAGE.md',
  'docs/TROUBLESHOOTING.md',
]

/** Patterns that mean "someone still has to write this". */
const patterns = [
  { re: /\bTODO\b/i, what: 'TODO' },
  { re: /\bTBD\b/i, what: 'TBD' },
  { re: /\bFIXME\b/i, what: 'FIXME' },
  { re: /\bXXX\b/, what: 'XXX' },
  { re: /lorem ipsum/i, what: 'lorem ipsum' },
  { re: /<\s*(insert|placeholder|fill)\b/i, what: '<insert|placeholder|fill>' },
  { re: /\bcoming soon\b/i, what: 'coming soon' },
]

const hits = []

for (const rel of files) {
  const abs = join(root, rel)
  if (!existsSync(abs)) {
    hits.push(`${rel}: file is missing`)
    continue
  }
  const lines = readFileSync(abs, 'utf8').split(/\r?\n/)
  lines.forEach((line, i) => {
    if (line.includes('<!-- docs-check: allow -->')) return
    for (const { re, what } of patterns) {
      if (re.test(line)) hits.push(`${rel}:${i + 1}: ${what} -> ${line.trim().slice(0, 100)}`)
    }
  })
}

if (hits.length > 0) {
  console.error(`docs-check: ${hits.length} leftover placeholder(s):`)
  for (const hit of hits) console.error(`  ${hit}`)
  process.exit(1)
}

console.log(`docs-check: ok (${files.length} files, no leftover placeholders)`)
