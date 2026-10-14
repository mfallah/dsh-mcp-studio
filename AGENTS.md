# AGENTS.md — working on `@mfallah/dsh-mcp-studio`

A DeepSeek Harness (DSH) plugin: a visual "MCP Studio" panel in the harness web
GUI for browsing, installing, connecting, testing and logging MCP servers.
User-facing docs are Persian-first; this file is for agents and stays English.

## Layout

| Path | What lives there |
| --- | --- |
| `src/shared/contract.ts` | The frozen host⇄client contract. Read it before touching either half. |
| `src/host/` | Cordis host service: store, secrets, connection supervisor, catalog, detection. |
| `src/client/` | Browser half: the sidebar panel, its state, and the `fa`/`en` locales. |
| `patch.yml` | The bundle layer that mounts the plugin when the package is installed. |
| `build.mjs` | esbuild build: `lib/index.js` (host ESM), `lib/client.js` (module-loader envelope), `lib/types/`. The output is committed — see Invariants. |
| `pnpm-workspace.yaml` | pnpm 11 settings. `allowBuilds: { esbuild: true }` is what lets esbuild install its platform binary on a clean checkout. |
| `install.ps1`, `install.sh` | Safe installers: timestamped backup, idempotent, `-DryRun`/`--dry-run`, `-Uninstall`/`--uninstall`. |
| `scripts/` | `check-docs.mjs` (CI guard), `test-install.ps1`, `test-install.sh` (offline installer tests). |
| `docs/` | `INSTALL.md`, `USAGE.md`, `TROUBLESHOOTING.md` — Persian-first, then a short English recap. `docs/DESIGN.md` records the design and its constraints; `docs/assets/` holds the README figure. |

## Commands

```bash
pnpm install           # --frozen-lockfile in CI: pnpm-lock.yaml must be committed and current
pnpm run typecheck     # tsc --noEmit
pnpm run build         # node build.mjs  -> lib/  (commit the result)
pnpm test              # vitest run
node scripts/check-docs.mjs
```

`pnpm-workspace.yaml` holds the pnpm 11 settings; keep build-script approval there,
not in a `pnpm` field in `package.json` (pnpm 11 ignores that field).

Installer tests are offline (temp `DSH_HOME`, stub `dsh`, no package manager):

```bash
powershell -NoProfile -File scripts/test-install.ps1   # Windows
bash scripts/test-install.sh                           # Git-Bash / WSL / macOS / Linux
```

## Invariants

- **One contract.** Every value crossing the RPC boundary is plain JSON. A field
  the contract does not name does not exist; add it to `src/shared/contract.ts`
  first, then to both halves.
- **Secret values never cross the boundary.** Only secret *names* do. Configs
  carry `${secret:NAME}` / `${env:NAME}` placeholders; the host resolves them at
  spawn time. `redactValue()` in the contract is the single redaction rule.
- **No manual YAML.** `package.json.dsh.bundle.patch` points at `patch.yml`, so
  `dsh plugin --profile <p> add <pkg>` is the whole install. Keep it that way:
  anything the plugin needs at run time belongs in its own store under
  `$DSH_HOME/mcp-studio/`, never in the profile's `cordis.patch.yml`.
- **Committed build output.** `lib/` is tracked on purpose (the `.gitignore`
  comment explains why): DSH loads the prebuilt `lib/client.js` at boot and
  refuses to activate a plugin whose bundle is missing, and `exports["./client"]`
  points straight at it. That is what makes a git-URL install work with no build
  step. `pnpm run build` is required after changing `src/`, and the rebuilt files
  must be committed — CI rebuilds and fails on a diff.
- **No runtime dependencies.** `dependencies` stays empty; the only peers are
  `@deepseek-ai/cordis`, `@deepseek-ai/dsh-mcp-client` and
  `@deepseek-ai/schemastery`, supplied by the harness. The package exports only
  `.`, `./client` and `./package.json` — there is no Typert subpath, because the
  panel talks over its owned HTTP route instead (see `docs/DESIGN.md` §4.2).
- **Docs track code.** `docs/*.md` and `README.md` describe behaviour that
  exists. When the code changes, change the docs in the same change; when
  something is not implemented, say so in `docs/TROUBLESHOOTING.md`.

## Windows notes

- `git` is not on `PATH` on the author's machine; the binary is
  `C:\Program Files\Git\cmd\git.exe`.
- Windows PowerShell 5.1 is the floor for `install.ps1`: no `Join-Path a b c`,
  no `??`, and write files through `Write-TextFile` so no UTF-8 BOM lands in the
  profile's YAML.
- Never restart or kill the harness that serves the GUI; verify with read-only
  commands (`dsh --profile <p> --dump-config`) instead.
