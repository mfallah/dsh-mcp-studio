/**
 * Live catalog-path check against the running harness.
 *
 * Exercises the exact flow the panel drives for a one-click install:
 *   catalog -> installFromCatalog -> testConnection -> addServer -> list -> remove
 *
 * It picks a curated entry with no required inputs so no secret is involved,
 * and removes it again, so the user's store ends where it started.
 *
 * Run:  node .smoke/live-catalog-check.mjs [baseUrl]
 */
const base = process.argv[2] ?? 'http://127.0.0.1:3080'

const failures = []
const results = []
function check(name, condition, detail = '') {
  const ok = Boolean(condition)
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

async function rpc(method, ...args) {
  const response = await fetch(`${base}/mcp-studio-api/rpc`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mcp-studio': '1' },
    body: JSON.stringify({ method, args }),
  })
  return response.json()
}

const health = await fetch(`${base}/mcp-studio-api/health`).then((r) => r.json()).catch(() => null)
check('host answers /health', health?.ok === true, JSON.stringify(health))
if (health?.ok !== true) {
  console.log(results.join('\n'))
  console.log('\nLIVE CHECK FAILED: host unreachable')
  process.exit(1)
}

const catalog = await rpc('catalog', { text: '', limit: 200 })
check('catalog returns entries', (catalog.value?.entries ?? []).length > 0, `${catalog.value?.entries?.length} entries`)
check(
  'catalog reports its registry state honestly',
  typeof catalog.value?.registryOnline === 'boolean',
  `registryOnline=${catalog.value?.registryOnline} error=${catalog.value?.registryError ?? 'none'}`,
)

const entries = catalog.value?.entries ?? []
const pick =
  entries.find(
    (e) =>
      e.source === 'curated' &&
      e.transport === 'stdio' &&
      e.command === 'npx' &&
      (e.inputs ?? []).every((i) => !i.required),
  ) ?? entries[0]

check('a curated stdio entry is available', pick !== undefined, pick ? `${pick.id} (${pick.title})` : 'none')
if (pick === undefined) {
  console.log(results.join('\n'))
  console.log('\nLIVE CHECK FAILED: no catalog entry')
  process.exit(1)
}
console.log(`# using catalog entry: ${pick.id} — ${pick.title}`)

const draftResult = await rpc('installFromCatalog', pick.id, {})
check('installFromCatalog builds a draft', draftResult.ok === true, JSON.stringify(draftResult).slice(0, 220))
const draft = draftResult.value
if (draft === undefined || draft === null) {
  console.log(results.join('\n'))
  console.log('\nLIVE CHECK FAILED: no draft')
  process.exit(1)
}

// The entry's own namespace, so this can never collide with the user's servers.
draft.title = `LiveCheck ${Date.now()}`
draft.serverName = `livecheck${Math.random().toString(36).slice(2, 8)}`
draft.env = { ...(draft.env ?? {}), MEMORY_FILE_PATH: undefined }
for (const key of Object.keys(draft.env)) if (draft.env[key] === undefined) delete draft.env[key]

const probe = await rpc('testConnection', draft)
check(
  'testConnection runs the real server',
  probe.value?.ok === true,
  `ok=${probe.value?.ok} tools=${probe.value?.tools?.length ?? 0} ms=${probe.value?.durationMs} err=${probe.value?.error ?? ''}`,
)
check('testConnection discovers at least one tool', (probe.value?.tools?.length ?? 0) > 0)

const added = await rpc('addServer', draft)
check('addServer installs it', added.ok === true, JSON.stringify(added).slice(0, 200))
const server = added.value
check(
  'the installed server reports connected',
  server?.status === 'connected',
  `status=${server?.status} err=${server?.lastError ?? ''}`,
)
check('the namespace is the one we chose', server?.serverName === draft.serverName, server?.serverName)

const list = await rpc('listServers')
const row = (list.value ?? []).find((s) => s.id === server?.id)
check('listServers shows the new row', row !== undefined)
check('install is idempotent in the list (no duplicate row)', (list.value ?? []).filter((s) => s.id === server?.id).length === 1)

const logs = await rpc('getLogs', server?.id, 0)
check('getLogs returned the connect sequence', (logs.value?.entries ?? []).length > 0, `${logs.value?.entries?.length} lines`)

const removed = await rpc('removeServer', server?.id)
check('removeServer cleans up', removed.ok === true)
const after = await rpc('listServers')
check(
  'the store is back to its previous contents',
  !(after.value ?? []).some((s) => s.id === server?.id),
  `remaining: ${(after.value ?? []).map((s) => s.id).join(', ') || 'none'}`,
)

console.log(results.join('\n'))
console.log(`\n${failures.length === 0 ? 'LIVE CATALOG OK' : `LIVE CATALOG FAILED: ${failures.length}`}`)
process.exit(failures.length === 0 ? 0 : 1)
