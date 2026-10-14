# Changelog

All notable changes to `@mfallah/dsh-mcp-studio` are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Host service `mcpStudio` with the frozen remote API in `src/shared/contract.ts`:
  server CRUD, enable/disable, restart, pre-save connection probes, per-server log
  tails, catalog search, runtime detection, and a secret store that never sends
  secret values over the wire.
- Client half: an MCP Studio panel in the harness web sidebar with a server list,
  a catalog browser, an add/edit form, a connection test, a live log viewer, and
  a patch exporter.
- Bundle layer `patch.yml`, so `dsh plugin --profile <name> add @mfallah/dsh-mcp-studio`
  activates the plugin with no manual YAML editing.
- `install.ps1` (Windows) and `install.sh` (Git-Bash / WSL / macOS / Linux):
  timestamped backups, idempotent install, `-DryRun`, and `-Uninstall`.
- Documentation: `README.md` (Persian-first), `docs/INSTALL.md`, `docs/USAGE.md`,
  `docs/TROUBLESHOOTING.md`.
- GitHub Actions CI running typecheck, build and tests on Node 22, checking that the
  committed `lib/` output is current and that no doc carries a leftover placeholder.

### Changed

- `lib/` is committed rather than gitignored. DSH loads the prebuilt `lib/client.js`
  at boot and refuses to activate a plugin whose bundle is missing, so shipping the
  build output is what makes `dsh plugin --profile web add <git-url>` work with no
  build step. `pnpm run build` is only needed after changing `src/`.
- Build-script approval moved to `pnpm-workspace.yaml` (`allowBuilds: { esbuild: true }`);
  the `pnpm.onlyBuiltDependencies` field was removed from `package.json`, which
  pnpm 11 ignores.
- The plugin now has no runtime npm dependencies (`dependencies: {}`). Its only peers
  are `@deepseek-ai/cordis`, `@deepseek-ai/dsh-mcp-client` and `@deepseek-ai/schemastery`,
  all supplied by the harness.
- Package exports are `"."`, `"./client"` and `"./package.json"`. The `./typert` and
  `./remote` subpaths and the `@deepseek-ai/dsh-typert-protocol` / `zod` dependencies
  were removed: the panel reaches its host half over an owned HTTP route, because
  `@deepseek-ai/dsh-api-remotes` fixes its reachable capability set at build time.
- The panel now follows the harness Appearance setting (light or dark). It paints
  from the harness's own `--dsw-*` theme tokens and may only reference names listed in
  `src/client/theme-tokens.ts`; an invented token name with a dark fallback was what
  made the panel render dark in light mode.

### Fixed

- The panel no longer crashes on first render. `src/client/face.ts` wraps the locale
  service so `getSnapshot`/`subscribe` keep their receiver and their identity across
  renders; `useDirection` memoises the store and type-checks the snapshot. Previously
  the whole panel rendered as a blank white page for every user.
- A tool-namespace collision is now reported up front as `namespace-in-use`. When
  `mcp__<name>__*` is already owned by an MCP server outside MCP Studio — typically a
  row in `<profile>/cordis.patch.yml`, where the shipped profiles define
  `mcp__memory__*` and `mcp__filesystem__*` — the add is refused with an actionable
  message instead of the bridge's raw "tool … is already registered" after a spawn
  attempt. `install.ps1`/`install.sh` are unaffected.

[Unreleased]: https://github.com/mfallah/dsh-mcp-studio/commits/main
