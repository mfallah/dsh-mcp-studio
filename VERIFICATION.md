# Independent Verification — `@mfallah/dsh-mcp-studio`

**Verifier:** `verifier` (independent teammate; wrote no product code)
**Revision tested:** `19f2cd1613233209b7a035dc06f241cbc6c72912` (`feat: visual MCP Studio for DeepSeek Harness`), branch `main`
**Working tree at test time:** clean (`git status --short` empty, before and after the in-place rebuild)
**Date:** 2026-10-14, Windows, Node v22.18.0, harness live at `http://127.0.0.1:3080`
**`git` note:** `git` is not on `PATH` on this machine; every git command below uses
`& 'C:\Program Files\Git\cmd\git.exe'`.

## Hashes of the artifacts actually exercised

| Artifact | SHA-256 |
| --- | --- |
| commit | `19f2cd1613233209b7a035dc06f241cbc6c72912` |
| `lib/index.js` (host bundle booted by every isolated test) | `6288efbd20d4662097a490053108d8f614b068107fb58d2f3df600cac062527d` |
| `lib/client.js` | `1b628b4aabf2a793cd3ffd0f3461f27307100b7b1c396ed5cdb4e8c9a8a356e6` |
| `lib/index.js.map` | `e5102283546ab60fde03d43ee4a4bd692ab0558afedf81f99b04805704454322` |
| `src/host/http.ts` | `eb37a2ea217e79352227f6c3377e29b43c1891c83871222b59f5728315db7008` |
| `src/host/service.ts` | `04821ae5326d5a475543129ec787b330d804a71c9ebf6947737f0f680cacda6f` |
| `src/host/connection.ts` | `30c7a4baf6ff261e79378edfe29e3e50bcb9ca42003778676838e95940065cd6` |
| `src/host/secrets.ts` | `b20fd54da245633d1d21dfd512000e5c08121c0cdf708afcaf76eefdd4e736c9` |
| `src/host/store.ts` | `42a788eea948a395cb8ff26ea64eb7319eedc3dbdac423b8084f0b4756cb6493` |
| `src/host/resolve.ts` | `8567cc264ea8cbdc97b4437f27a0679ab0e4f9cbcbc4462b18405fdce6dd0631` |
| `src/host/logs.ts` | `9f2fb1759585293392a85dc5e5f06dceb63258102b57f38f58cd4dceac3cfbd4` |
| `src/shared/contract.ts` | `f5070bf923d42d77892dbe75916e9d984557e59455fe9bf8d93e47b5ca1ef644` |

Scripts written by the verifier (inside the permitted write scope):

- [`tests/e2e/adversarial-host-api.mjs`](tests/e2e/adversarial-host-api.mjs) — 44 checks, boots `lib/index.js` in an isolated Cordis runtime.
- [`tests/e2e/docs-claims-runtime.mjs`](tests/e2e/docs-claims-runtime.mjs) — runtime probes for specific doc claims.
- [`tests/e2e/oversized-body.mjs`](tests/e2e/oversized-body.mjs) — minimal raw-socket reproduction of D2.

---

## Check 1 — Build reproducibility · **PASS**

```
cd F:\harness\dsh-mcp-studio
& 'C:\Program Files\Git\cmd\git.exe' status --short -- lib      # (empty)
node build.mjs                                                  # exit 0
& '...\git.exe' status --short -- lib                           # (empty)
& '...\git.exe' diff --exit-code -- lib                         # exit 0
& '...\git.exe' diff --ignore-cr-at-eol --exit-code -- lib      # exit 0
```

Observed:

```
=== before build: git status --short -- lib ===
=== node build.mjs ===
[build] @mfallah/dsh-mcp-studio v0.1.0 -> lib/
BUILD_EXIT=0
=== after build: git status --short -- lib ===
=== git diff --exit-code -- lib ===
GITDIFF_EXIT=0
```

`lib/` is tracked (42 files) and the rebuild is **byte-for-byte identical** to the commit:
`lib/index.js`, `lib/client.js` and `lib/index.js.map` all kept the same SHA-256
(`6288efbd…`, `1b628b4a…`, `e5102283…`) after the rebuild, and the whole tree stayed clean
(`git diff HEAD --stat` empty). This holds despite `core.autocrlf=true`; `.gitattributes`
(`* text=auto eol=lf`) keeps the regenerated output LF.

**Verdict:** the CI step `git diff --exit-code -- lib` in
[`.github/workflows/ci.yml`](.github/workflows/ci.yml#L48-L49) **should stay**. It is meaningful
now that `lib/` is tracked.

**Cross-check on a different OS (independently fetched, not taken on trust).** I fetched the GitHub
Actions API for the run on this commit:
`GET https://api.github.com/repos/mfallah/dsh-mcp-studio/actions/runs/38552021625` →
`"head_sha":"19f2cd1613233209b7a035dc06f241cbc6c72912"`, `"status":"completed"`,
`"conclusion":"success"`. So step 8 (`git diff --exit-code -- lib`) passes on `ubuntu-latest` too,
against a `lib/` produced on Windows — the committed output is stable across Linux/Windows and the
`core.autocrlf=true` setting this machine has. My local result and CI's agree.

> Historical note (before the freeze): the repository had **zero commits** and `lib/` was untracked
> (`git ls-files | Measure-Object` → 0; `git status --short -- lib` → `?? lib/`). At that time
> `git diff --exit-code -- lib` could not have failed — untracked files are invisible to
> `git diff`. That hazard is removed by commit `19f2cd16`, which tracks `lib/`.

---

## Check 2 — Full test suite · **PASS**

```
npx tsc --noEmit        # exit 0, no output
npx vitest run          # exit 0
```

Observed (14:17:13):

```
Test Files  11 passed (11)
     Tests  188 passed (188)
  Duration  15.49s
VITEST_EXIT=0
```

Typecheck produced no diagnostics at all. (An earlier 14:09 run *did* show
`src/client/state.ts(416,5): error TS2741` and `vitest` 187/188 with one
`tests/client/controller.test.ts` failure. Both were re-checked at the frozen revision and are
gone; they were mid-edit artifacts, and they are **not** counted as defects.)

---

## Check 3 — Adversarial host API · **43/44 PASS, 1 FAIL (documented 413, see D2)**

Command: `node tests/e2e/adversarial-host-api.mjs` (bundle `6288efbd…`).

| Attack | Result |
| --- | --- |
| `{"method":"constructor"}` | PASS — `ok:false, code:"unknown-method"` |
| `{"method":"__proto__"}` | PASS — `unknown-method` |
| `{"method":"referencesTo"}` (real service method, not allow-listed) | PASS — `unknown-method` |
| `hasOwnProperty` / `toString` / `valueOf` / `apply` | PASS — all `unknown-method` |
| non-array `args` | PASS — HTTP 400 |
| malformed JSON body | PASS — HTTP 400 |
| missing `method` | PASS — HTTP 400 |
| `addServer` with `env:{A:"${secret:DOES_NOT_EXIST}"}` | PASS — `ok:true` but `status:"error"`, `lastError:"…cannot connect: missing secret(s): DOES_NOT_EXIST"`, `toolCount:0`, no registration, failure visible in `getLogs`. Never connected. |
| two `addServer` calls, same `serverName` | PASS — second fails `duplicate-server-name`; `listServers` shows exactly one row |
| 2 MiB body | **PASS (refused) / FAIL (no 413)** — never 200, server survives, but client sees `ECONNRESET` instead of the documented `413` (D2) |
| `Origin: http://evil.example` | PASS — 403 |
| `Sec-Fetch-Site: cross-site` | PASS — 403 |
| no `x-mcp-studio` header | PASS — 403 (`x-mcp-studio: 0` also 403) |
| `getServer("../../../etc/passwd")` | PASS — `ok:false, code:"invalid-id"` |
| `getLogs("..\\..\\windows\\win.ini")` | PASS — `invalid-id` |

Raw output for the oversized case:

```
oversized raw-socket outcome: {"event":"error","code":"ECONNRESET","message":"read ECONNRESET"}
small body (1 KiB):                  {"event":"response","status":200,...}
oversized body (2 MiB):              {"event":"error","code":"ECONNRESET"}
small body after the oversized one:  {"event":"response","status":200,...}
```

---

## Check 4 — Secret non-leakage · **PASS**

By test (`tests/e2e/adversarial-host-api.mjs`, section F): a sentinel value `SENTINEL-9f3a7c1d-DO-NOT-LEAK`
was written with `setSecret`, then a real `npx -y @modelcontextprotocol/server-memory@2026.7.4`
connected with `DEMO_TOKEN:"${secret:DEMO_TOKEN}"`, plus an HTTP server with
`Authorization: "Bearer ${secret:DEMO_TOKEN}"` pointed at a dead port to force the error path.

```
PASS  setSecret stores the name (not the value)
PASS  stdio server using a secret connects — status=connected
PASS  http server using a secret is not silently connected — status=error
PASS  no RPC response body contains the secret value — hits=0
PASS  the ONLY store file containing the secret value is secrets.json — files_with_value=[secrets.json] all_files=[secrets.json, servers.json]
PASS  servers.json does not contain the secret value
PASS  servers.json holds the placeholder, not the value
PASS  secret value IS in secrets.json (that is where it belongs)
PASS  no log entry or detail payload contains the secret value
PASS  secret-in-use deletion is refused
```

The store directory was grepped recursively for the literal sentinel: the only hit is
`secrets.json`, which is the secret store and is the intended location. `servers.json` holds
`"DEMO_TOKEN": "${secret:DEMO_TOKEN}"`.

By inspection: `secrets.get(` appears in exactly one place outside the store itself —
[`src/host/resolve.ts:74`](src/host/resolve.ts#L74) — which feeds the child bridge payload only.
`listSecretNames` returns `names()`; `resolveConfig` returns only a `ResolutionReport`; `getServer`
returns the persisted config (placeholders). Log lines are built from
`describeConfig()` (command + args or url) and from error messages; neither includes env/header
values. `installFromCatalog` was checked directly against the live API for three real catalog
entries:

```
curated:brave-search → env:{"BRAVE_API_KEY":"${secret:BRAVE_API_KEY}"}   contains hunter2: False
curated:github       → headers:{"Authorization":"${secret:Authorization}"} contains hunter2: False
curated:postgres     → env:{"DATABASE_URI":"${secret:DATABASE_URI}"}     contains hunter2: False
```

**Caveat (not a secret-store leak):** a literal value a user pastes into a *non-secret* env/header
field is persisted in `servers.json` and is returned to the browser by `getServer`; the panel hides
it only at render time (`redactValue` in
[`src/client/panel/ServerDrawer.tsx:258`](src/client/panel/ServerDrawer.tsx#L258)). This matches the
documented model (secret-flagged inputs go to the store) but means the browser boundary protects
`secrets.json` values, not arbitrary pasted literals.

---

## Check 5 — Corruption resilience · **PASS**

`tests/e2e/adversarial-host-api.mjs`, section G: a temp store was pre-seeded with
`servers.json` containing `{ this is not json at all`, then the plugin was booted.

```
PASS  plugin boots with a corrupt servers.json
PASS  API still serves after corruption — {"ok":true,"value":[]}
PASS  corrupt file is quarantined, not deleted — dir=[servers.corrupt-2026-10-14T10-47-20-114Z.json]
PASS  quarantined file keeps the original bytes
PASS  store is writable after quarantine
```

The API served normally, the corrupt file was moved aside (not deleted, bytes intact), and a
subsequent `addServer` persisted. The symmetric `secrets.json` path
([`src/host/secrets.ts:200-208`](src/host/secrets.ts#L200-L208)) is not exercised by a test of mine — see
"Claims I could not confirm".

---

## Check 6 — Live-harness truth · **PASS**

Against the running harness (never restarted, never signalled):

```
GET http://127.0.0.1:3080/mcp-studio-api/health
→ 200 {"ok":true,"name":"@mfallah/dsh-mcp-studio","version":"0.1.0","servers":1}

POST /mcp-studio-api/rpc  header x-mcp-studio: 1  {"method":"listServers","args":[]}
→ 200 {"ok":true,"value":[{"id":"thinking","serverName":"thinking","title":"Sequential Thinking",
    "status":"connected","tools":["sequentialthinking"],"toolCount":1,
    "connectedAt":"2026-10-14T10:39:44.669Z", ...}]}
```

Independent corroboration, not the plugin's own `status` field:

1. `dsh --profile web --dump-config` reports the plugin composed into the profile:
   `- id: mcp-studio` / `name: '@mfallah/dsh-mcp-studio'` with
   `probeTimeoutMs: 60000, mountTimeoutMs: 90000` (matching `patch.yml`).
2. The harness itself injected the tool schema `mcp__thinking__sequentialthinking` into **this
   session's** tool list, and I invoked it successfully — the call returned
   `{"thoughtNumber":1,"totalThoughts":1,"nextThoughtNeeded":false,"thoughtHistoryLength":1}`.

That is direct evidence that the `connected` row corresponds to a live, model-visible
`mcp__<name>__*` tool, not merely to a status string. (The `memory`/`filesystem` MCP servers visible
in this session come from the profile's own `cordis.patch.yml`, not from MCP Studio.)

---

## Check 7 — Docs honesty

Each claim was checked against code or a live/isolated run.

| # | Claim (file:line) | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | 34 bundled offline catalog entries — [README.md:61](README.md#L61), [docs/USAGE.md:23](docs/USAGE.md#L23) | **PASS** | live `catalog {source:"curated",limit:500}` → `total=34`, `entries=34`, `registryOnline=false` |
| 2 | Secret inputs go to the secret store, never `servers.json` — [docs/USAGE.md:37](docs/USAGE.md#L37), [docs/DESIGN.md:200-202](docs/DESIGN.md#L200-L202) | **PASS** | `installFromCatalog` returned only `${secret:…}` refs (3 entries above); adversarial grep found the value only in `secrets.json` |
| 3 | Secrets at `$DSH_HOME/mcp-studio/secrets.json`, `0600`, Windows ACL tightened — [README.md:78-80](README.md#L78-L80), [docs/USAGE.md:93-95](docs/USAGE.md#L93-L95) | **PASS** | `icacls` on a file written by the plugin: `secrets.json ABZ90\abz19:(F)` — inheritance stripped, single ACE. `writeFileAtomic` passes `mode: 0o600` (POSIX-only; Windows is the ACL) |
| 4 | Registry is `GET <base>/v0.1/servers`, keyless, 5-minute cache — [docs/DESIGN.md:176](docs/DESIGN.md#L176), [src/host/catalog.ts:26](src/host/catalog.ts#L26), [:35](src/host/catalog.ts#L35) | **PASS** | `REGISTRY_PATH='/v0.1/servers'`; `DEFAULT_CACHE_TTL_MS=5*60_000`; request sends only `accept: application/json` (no auth) |
| 5 | Logs are RAM-only, 500-line default per server — [docs/USAGE.md:79-80](docs/USAGE.md#L79-L80), [docs/TROUBLESHOOTING.md:124-125](docs/TROUBLESHOOTING.md#L124-L125) | **PASS** | `Config.logLinesPerServer` default `500` ([src/host/index.ts:73](src/host/index.ts#L73)); `LogBuffer` is an in-memory `Map`; `logs.ts` imports no `fs` |
| 6 | Tools are exposed as `mcp__<server>__<tool>` — [README.md:66](README.md#L66), [docs/USAGE.md:78](docs/USAGE.md#L78) | **PASS** | live invocation of `mcp__thinking__sequentialthinking` succeeded (Check 6) |
| 7 | Corrupt stores are quarantined as `servers.corrupt-<date>.json` / `secrets.corrupt-<date>.json` — [docs/TROUBLESHOOTING.md:110-120](docs/TROUBLESHOOTING.md#L110-L120) | **PASS** (servers only) | `servers.corrupt-2026-10-14T10-47-20-114Z.json` produced with original bytes; `secrets.corrupt-*` is the same code path but was not run |
| 8 | Installer verifies with `dsh --profile web --dump-config` — [docs/INSTALL.md:39](docs/INSTALL.md#L39), [:132-136](docs/INSTALL.md#L132-L136) | **PASS** | [install.ps1:222-233](install.ps1#L222-L233) + [:513](install.ps1#L513); the live dump-config shows the plugin composed |
| 9 | Timestamped backups at `$DSH_HOME/mcp-studio/backups/<stamp>/` with `manifest.json` — [docs/INSTALL.md:57-58](docs/INSTALL.md#L57-L58), [docs/TROUBLESHOOTING.md:100](docs/TROUBLESHOOTING.md#L100) | **PASS** | `New-ProfileBackup` writes `manifest.json`; the live `backups/` directory exists; `scripts/test-install.ps1` verifies it (25 checks) |
| 10 | `/mcp-studio-api` requires `x-mcp-studio: 1`, rejects cross-origin, caps the body — [README.md:82-83](README.md#L82-L83), [docs/DESIGN.md:150-151](docs/DESIGN.md#L150-L151) | **PASS for the guards, FAIL for the 4xx status** | guards verified (Check 3); the cap is enforced but the client gets a socket reset, not the `413` promised at [src/host/http.ts:21-24](src/host/http.ts#L21-L24) — see D2 |
| 11 | `lib/` is committed and CI fails on a stale rebuild — [README.md:148-151](README.md#L148-L151), [docs/DESIGN.md:73](docs/DESIGN.md#L73) | **PASS at this commit** | Check 1: 42 tracked files, rebuild byte-identical, `git diff --exit-code -- lib` exit 0. **Was false before the freeze** (zero commits, untracked `lib/`) |
| 12 | Advanced-config table shows the effective values — [docs/USAGE.md:140-141](docs/USAGE.md#L140-L141) | **FAIL (docs)** | the table lists the *schema* defaults (`probeTimeoutMs: 15000`, `mountTimeoutMs: 30000`), but the shipped bundle layer [patch.yml:20-21](patch.yml#L20-L21) sets `60000`/`90000`, and the live composed config confirms `60000`/`90000` — see D4 |
| 13 | Server name must be `[A-Za-z0-9_-]`, at most 32 chars — [docs/USAGE.md:117-118](docs/USAGE.md#L117-L118) | **PARTIAL / FAIL** | `bad name!` is rejected (`invalid-server-name`), but a 33-char name is **silently truncated to 32 and accepted** ([src/host/service.ts:171](src/host/service.ts#L171)) — see D3 |
| 14 | Probe runs under a temporary name so it cannot displace a live server — [docs/USAGE.md:46](docs/USAGE.md#L46) | **FAIL (misleading)** | it cannot displace, but a probe of a draft whose `serverName` is already installed is rejected outright — see D1 |

Also run: `node scripts/check-docs.mjs` → `docs-check: ok (6 files, no leftover placeholders)`, exit 0.

---

## Check 8 — Installer safety

### `powershell -NoProfile -File scripts/test-install.ps1` · **PASS**

```
work dir: C:\Users\abz19\AppData\Local\Temp\mcp-studio-test-60b6271205a5493399c20e3f4d877c4f
...
  ok   DryRun left package.json byte-identical
  ok   DryRun left cordis.patch.yml byte-identical
  ok   DryRun created no new backup directory
PASSED: 25 checks
PS1_EXIT=0
```

25 checks, 25 passed, exit 0.

### `bash scripts/test-install.sh` · **INCONCLUSIVE**

```
BASH=C:\WINDOWS\system32\bash.exe
Windows Subsystem for Linux has no installed distributions.
SH_EXIT=1
```

`bash` on `PATH` is the WSL launcher and there is no distro installed, so the script never ran.
Not a product failure. It would need Git-Bash, WSL with a distro, or a Linux/macOS host.

### `.\install.ps1 -DryRun` · **PASS (changes nothing)**

Exact command and result:

```
cd F:\harness\dsh-mcp-studio
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -DryRun
```

```
   [dry-run] mkdir C:\Users\abz19\.dsh\mcp-studio\backups
   [dry-run] copy C:\Users\abz19\.dsh\profiles\web\package.json -> <timestamp>/package.json
   [dry-run] copy C:\Users\abz19\.dsh\profiles\web\cordis.patch.yml -> <timestamp>/cordis.patch.yml
   [dry-run] skip: dsh plugin --profile web add "F:\harness\dsh-mcp-studio" (dependency already present)
   [ok] dry run complete - no file was created, changed or deleted
DRYRUN_EXIT=0
```

File-hash proof: SHA-256 of **131 files** (all of `F:\harness\dsh-mcp-studio` excluding
`node_modules/` and `.git/`, plus `C:\Users\abz19\.dsh\profiles\web\**` and
`C:\Users\abz19\.dsh\mcp-studio\**`) was captured before and after.

```
hashed files before: 131
hashed files after: 131
RESULT: IDENTICAL - no file created, changed or deleted by -DryRun
```

---

## Check 9 — Second, independent end-to-end path · **PASS**

`tests/e2e/adversarial-host-api.mjs`, section H, used
`@modelcontextprotocol/server-sequential-thinking@1.0.0` — a different real server from the smoke
test's `@modelcontextprotocol/server-memory`.

```
PASS  second, different MCP server connects — ok=true status=connected lastError=undefined
PASS  its tools register under mcp__seqthink__* — registered=[mcp__seqthink__sequentialthinking]
   tools seen: [mcp__seqthink__sequentialthinking]
PASS  the second server removes cleanly
PASS  its tools are unregistered after removal
```

Tool name observed: **`mcp__seqthink__sequentialthinking`** (server `seqthink`), removed afterwards.
The smoke server's own path registered 9 tools (`mcp__leakprobe__create_entities`, …,
`mcp__leakprobe__open_nodes`) during the secret test, so both bridges demonstrably work.

---

## Defects found

### D1 — `testConnection` cannot probe a draft whose `serverName` is already installed · **MEDIUM**

**Impact:** re-testing an already-installed server from the catalog sheet, or testing an edited
server that keeps its name, fails with a confusing `invalid-config` and never runs the probe. The
docs describe the opposite intent.

**Minimal reproduction** (against the live harness, read-only, no state change):

```
POST http://127.0.0.1:3080/mcp-studio-api/rpc     header: x-mcp-studio: 1
{"method":"testConnection","args":[{"transport":"stdio","title":"re-test of an installed server",
 "serverName":"thinking","command":"npx","args":["-y","@modelcontextprotocol/server-sequential-thinking@1.0.0"]}]}
```

Observed:

```json
{"ok":true,"value":{"ok":false,
 "error":"server name \"thinking\" is already used by \"Sequential Thinking\"",
 "code":"invalid-config","durationMs":0}}
```

Reproduced in isolation too (`tests/e2e/docs-claims-runtime.mjs`):

```
PASS  live server connects — status=connected
FAIL  probe against the live name succeeds — {"ok":false,"error":"server name \"livetarget\" is already used by \"Live Seq\"","code":"invalid-config","durationMs":0}
```

**Cause:** [`src/host/service.ts:237-244`](src/host/service.ts#L237-L244) `draftToProbeConfig()` already
knows it must avoid name clashes (it invents `probeXXXXXX` as the id), but it calls
`draftToConfig()` with the user's name, and that method performs the duplicate check at
[`src/host/service.ts:180-186`](src/host/service.ts#L180-L186) against the store before the temporary
name is ever applied. The reachable UI path is
[`src/client/state.ts:510`](src/client/state.ts#L510) `testConnection(await installFromCatalog(...))`,
where `entryToDraft` sets `serverName` from the entry slug
([`src/host/install-template.ts:219`](src/host/install-template.ts#L219)).

**Contract violation:** [`src/shared/contract.ts:346`](src/shared/contract.ts#L346) documents
`testConnection` as "Connect a draft without persisting it" — it should not fail because a server of
that name exists.

Related docs miss: [docs/USAGE.md:46](docs/USAGE.md#L46) says the probe "runs with a temporary name, so
it cannot displace a live same-named server" — true, but it silently omits that the request is
rejected, and [docs/TROUBLESHOOTING.md:41-54](docs/TROUBLESHOOTING.md#L41-L54) has no code/meaning for
this case (the returned `invalid-config` is described as "configuration is incomplete", which is
wrong here).

### D2 — Oversized body yields `ECONNRESET`, never the documented `413` · **MEDIUM-LOW**

**Impact:** a too-large request gets a connection reset instead of a readable JSON error; the browser
panel sees a network failure, not `body-too-large`.

**Minimal reproduction:** `node tests/e2e/oversized-body.mjs`

```
small body (1 KiB):                  {"event":"response","status":200,"body":"{\"ok\":true,\"value\":[]}"}
oversized body (2 MiB):              {"event":"error","code":"ECONNRESET","message":"read ECONNRESET"}
small body after the oversized one:  {"event":"response","status":200,"body":"{\"ok\":true,\"value\":[]}"}
expected by docs/http.ts: 413 with a JSON error envelope
```

**Cause:** [`src/host/http.ts:115-131`](src/host/http.ts#L115-L131) `readBody()` rejects and then calls
`req.destroy()`, which tears down the socket before the caller can write the `413` from
[`src/host/http.ts:188-194`](src/host/http.ts#L188-L194). The module's own wire contract at
[`src/host/http.ts:21-24`](src/host/http.ts#L21-L24) says "oversized or malformed body … use a 4xx
status", and `DESIGN.md` §4.3 makes the same promise.

**What does hold:** the body is refused (never 200), the server survives, and the next request is
served normally. The requirement "refused, not buffered to death" is met; the documented status code
is not.

### D3 — `serverName` longer than 32 chars is silently truncated, not rejected · **LOW**

**Impact:** `docs/USAGE.md:117-118` tells the user the name is capped at 32 characters; the product
instead rewrites the name without telling anyone. Two different user names that share their first 32
characters collapse onto one `serverName`, producing a later `duplicate-server-name` or an
unexpected tool namespace.

**Minimal reproduction:** `node tests/e2e/docs-claims-runtime.mjs`

```
FAIL  33-character serverName is rejected as invalid-server-name —
      {"ok":true,"value":{"id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
       "serverName":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","title":"Too Long",...}}
```

**Cause:** [`src/host/service.ts:171`](src/host/service.ts#L171) —
`clean(draft.serverName ?? '', 32)` truncates before the `SERVER_NAME_RE` check can ever see a
too-long name.

### D4 — Docs list timeout values that the shipped bundle layer overrides · **LOW (docs)**

[docs/USAGE.md:140-141](docs/USAGE.md#L140-L141) presents `probeTimeoutMs: 15000` and
`mountTimeoutMs: 30000` as the effective configuration, but [patch.yml:20-21](patch.yml#L20-L21) sets
`probeTimeoutMs: 60000` and `mountTimeoutMs: 90000`, and the live composed config agrees:

```
$ dsh --profile web --dump-config | Select-String -Pattern 'mcp-studio' -Context 0,12
- id: mcp-studio
  name: '@mfallah/dsh-mcp-studio'
  config:
    catalogEnabled: true
    registryUrl: https://registry.modelcontextprotocol.io
    probeTimeoutMs: 60000
    mountTimeoutMs: 90000
```

The numbers are the schema defaults ([src/host/index.ts:69](src/host/index.ts#L69), [:71](src/host/index.ts#L71)),
so the table is not *false*, but a reader is misled about what is in force. Same class of issue at
[docs/TROUBLESHOOTING.md:51](docs/TROUBLESHOOTING.md#L51), which advises raising `probeTimeoutMs`
without saying the shipped value is already 60 s.

### D5 — Unknown `transport` is silently coerced to `stdio` · **LOW**

[`src/host/service.ts:169`](src/host/service.ts#L169) —
`const transport = draft.transport === 'streamable-http' ? 'streamable-http' : 'stdio'`. A draft with
`transport: "sse"` is accepted as a stdio server. The practical failure is then `invalid-command`
(a command is missing), which points the user at the wrong problem. Docs correctly state SSE is
unsupported ([docs/USAGE.md:147-148](docs/USAGE.md#L147-L148)); the code should say so explicitly
rather than coercing.

### D6 — Informational

- `lib/index.js.map` is committed and embeds source paths/content. Not a defect, but it is a build
  artifact that will churn on any comment-only source edit (`lib/index.js` can stay byte-identical
  while the map changes), so CI's `git diff --exit-code -- lib` will fail for comment-only changes.
- The verifier's three `tests/e2e/*.mjs` scripts are not picked up by `vitest run` (default include
  is `*.test.*` / `*.spec.*`), so they do not affect the 188-test count. They were committed as part
  of `19f2cd16`.

---

## Claims I could not confirm

1. **`bash scripts/test-install.sh` result.** INCONCLUSIVE — `bash` on `PATH` is the WSL launcher
   with no distribution installed (`Windows Subsystem for Linux has no installed distributions.`,
   exit 1). Would need Git-Bash, WSL with a distro, or a Linux/macOS host.
2. **GUI behaviour.** The panel itself was never rendered: sidebar icon, RTL/Persian layout, catalog
   and install sheets, auto-scroll logs, the 5 s poll and 2 s log tail, and the "copy patch" overlay
   are all unverified. There is no browser automation available in this session; a real browser
   session against `http://127.0.0.1:3080` is required.
3. **`-FromGitHub` install and activation via `dsh.bundle.patch` on a stock harness.** Not run — it
   would mutate the live profile the user's session depends on. The installer's own claim
   (`lib/` shipped so no build step is needed) is plausible from the tree state but unproven here.
4. **`secrets.json` corruption quarantine.** Only `servers.json` was corrupted and booted.
   `src/host/secrets.ts` has the same code path, but I did not execute it. A one-line addition to
   `tests/e2e/adversarial-host-api.mjs` (seed `secrets.json` with garbage) would close this.
5. **POSIX file mode `0600`.** Not verifiable on Windows; only the Windows ACL was measured.
6. **Secret non-leakage through a *failing* HTTP server whose error text echoes response headers.**
   My HTTP failure case returned no sentinel, but that is `ECONNREFUSED`, not a server that echoes
   headers back. A malicious/compromised MCP server echoing `Authorization` inside an error body
   could in principle reach `lastError`. I found no code that injects headers into error text, but I
   did not construct that server.
7. **Loopback-only enforcement inside the plugin.** `http.ts` checks `Origin` and `Sec-Fetch-Site`
   but never inspects the socket address; loopback-only comes from
   `@deepseek-ai/dsh-host-webserver`'s `host: ctx.webStartup.host ?? '127.0.0.1'`. Correct on this
   profile, but the plugin itself does not enforce it. Verifying a non-loopback deployment would
   need a second harness bound to `0.0.0.0`, which I did not start.
8. **That the live `thinking` row was mounted by *this* plugin rather than by the profile's own
   `cordis.patch.yml`.** The composed config contains both MCP Studio's store and first-party
   `mcp-memory`/`mcp-filesystem` inserts; the `thinking` row's `connectedAt` and the store content
   make MCP Studio the only plausible owner, and the store row + live tool agree, but I did not
   trace the mount call in a harness log.

---

## Bottom line

- Check 1 PASS, Check 2 PASS, Check 3 43/44 (one real defect), Check 4 PASS, Check 5 PASS,
  Check 6 PASS, Check 7 12 PASS / 3 FAIL-on-docs, Check 8 ps1 PASS + sh INCONCLUSIVE + DryRun PASS,
  Check 9 PASS.
- The security-critical properties I was asked to falsify — method allow-list, guard headers,
  origin fence, id grammar, secret non-leakage, corruption resilience, duplicate-name rejection,
  missing-secret rejection — **held**.
- The graded defects are product behaviour, not test artifacts: **D1** (probe rejects a draft whose
  name is already installed), **D2** (oversized body → `ECONNRESET` instead of `413`), **D3** (silent
  32-char truncation), plus docs drift **D4** and coercion **D5**. None of them was fixed by me; the
  frozen tree at `19f2cd16` is exactly what was tested.
