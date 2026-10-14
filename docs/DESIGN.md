# MCP Studio — design

**Package** `@mfallah/dsh-mcp-studio` · **target** DeepSeek Harness (DSH) `0.2.0-rc.2` and later
**Repo** `https://github.com/mfallah/dsh-mcp-studio` · **Status** v0.1

---

## 1. Intent

Installing an MCP server into DSH today means editing `cordis.patch.yml` by hand
and restarting:

```yaml
- insert:
    - id: mcp-memory
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: memory
        transport: stdio
        command: npx
        args: ['-y', '@modelcontextprotocol/server-memory']
```

That is fine for an expert with one server. It is the wrong shape for a user who
wants to try five servers, paste a token, and see which ones actually connected.

MCP Studio replaces that with a panel inside the harness: search a catalog,
install with a form, watch the connection state, see the discovered tools and the
live log, and manage secrets — without editing a file, and without restarting the
harness.

## 2. Goals / non-goals / anti-goals

**Goals**

- One screen where a server goes from "not installed" to "connected, N tools
  visible to the model" with no file editing and no restart.
- A catalog that works with the network **off**: a curated offline set that
  degrades to registry-backed search when reachable, never the reverse.
- Honest state. Six connection states, real error text, real logs. No spinner
  that hides a failure.
- Secrets that are never rendered, never logged, and never written into the
  profile's YAML.
- A five-minute install for the user, and an uninstall that really reverts.

**Non-goals (v0.1)**

- OAuth for remote MCP servers. The catalog can *describe* a remote server, but
  a server that needs a browser auth dance is documented as manual for now.
- Publishing to npm. Install is from a git URL or a local path.
- Editing arbitrary other plugin configuration. MCP Studio manages MCP servers.

**Anti-goals — these would make the release a failure even if everything runs**

- Writing into `cordis.patch.yml` on the user's behalf. Their patch layer is
  theirs; a plugin that silently rewrites it is a plugin you cannot trust.
- Sending a secret to the browser, or into a log line, or into an error message.
- Reporting a server as connected when the connection failed, or hiding a tool
  list behind a spinner.
- Taking the whole harness down when one MCP server misbehaves.

## 3. Constraints discovered in the harness (evidence, not assumption)

Each of these was verified against the shipped packages before the design was
fixed. They are the reason the architecture looks the way it does.

| # | Constraint | Consequence |
|---|---|---|
| C1 | `@deepseek-ai/dsh-api-remotes` fixes its reachable capability set from **build-time imports**; the client does not discover host services at runtime, and forwarded events need an entry in a first-party allowlist. | A third-party plugin **cannot** rely on Typert RPC (`ctx.remote.mcpStudio`) for its own host half. |
| C2 | `ctx.webServer` is a documented plugin-facing route registry ("feature plugins claim their routes"). | The panel talks to one owned HTTP endpoint instead. See §5. |
| C3 | A plugin module that also exports `default` loses its `inject` metadata (`unwrapExports` prefers `.default`). | `src/host/index.ts` exports `name` / `Config` / `apply` and **no** default. |
| C4 | The client bundle format is neither ESM nor IIFE: `window.__ModuleLoader__.load({ id, factory(require) })`, a classic script. | `build.mjs` wraps the esbuild CJS output in that exact envelope; the bundle is generated, never hand-written. |
| C5 | A **prebuilt** `lib/client.js` is mandatory; a missing bundle fails activation loudly. | `lib/` is committed, and CI rebuilds it and fails on a diff. |
| C6 | `dsh-mcp-client` is a normal Cordis plugin with `apply(ctx, config)`, one instance per server, disposal = disconnect. | The supervisor mounts it as a **child fiber** at runtime instead of writing config rows. |
| C7 | `ctx.plugin()` returns `Fiber & PromiseLike<Fiber>`, so a mount can be awaited to its true connected state. | A failed server becomes a per-row `error`, never a silent absence of tools. |
| C8 | Plugin code is trusted and runs in-process; there is no sandbox for installed host code. | The consent dialog in §7 is a product requirement, not a nicety. |
| C9 | pnpm 11 reads build-script approval from `pnpm-workspace.yaml`, not `package.json`. | `allowBuilds: { esbuild: true }` is committed, or a clean checkout has no bundler. |

## 4. Architecture

```
┌─ browser ────────────────────────────────────────────────────────────┐
│  src/client/                                                        │
│    index.ts      apply(): sidebar row + main panel, i18n            │
│    rpc.ts        the ONLY module that knows the wire format         │
│    state.ts      controller: poll, refetch-after-mutation, drafts   │
│    panel/*       CatalogTab, InstalledTab, InstallSheet, Drawer …   │
└───────────────▲─────────────────────────────────────────────────────┘
                │ POST /mcp-studio-api/rpc   { method, args }
                │ header: x-mcp-studio: 1
┌───────────────┴─────────────────────────────────────────────────────┐
│  host process                                                        │
│    src/host/http.ts        route + guard + JSON envelope             │
│    src/host/service.ts     McpStudioService — the API surface        │
│    src/host/connection.ts  ConnectionSupervisor — child fibers       │
│    src/host/store.ts       servers.json   (non-secret config)        │
│    src/host/secrets.ts     secrets.json   (values, ACL-restricted)   │
│    src/host/catalog.ts     curated ∪ registry (degrades gracefully)  │
│    src/host/detect.ts      which runtimes exist (npx, uvx, docker…)  │
│    src/host/logs.ts        bounded per-server ring buffer            │
└───────────────┬─────────────────────────────────────────────────────┘
                │ ctx.plugin({ apply, … }, config)
                ▼
        @deepseek-ai/dsh-mcp-client  × N   →  mcp__<server>__<tool>
```

### 4.1 Why a child fiber per server

`dsh-mcp-client` is written for one server per plugin instance; that is its
documented contract ("Each plugin instance connects to one MCP server; load
multiple instances in `cordis.yml`"). Mounting it dynamically is therefore not a
workaround — it is the same composition the profile expresses in YAML, executed
at runtime, with strictly better failure attribution:

- the mount promise resolves when connection **and** initial tool discovery have
  settled, so `await` gives a real answer instead of a guess;
- `failOnStartupError: true` plus our own `catch` turns a broken server into a
  row-level error with the underlying cause, while the harness keeps running;
- disposal is the bridge's own teardown, so tools unregister and the
  `serverName` namespace is released by the code that owns it.

### 4.2 Why HTTP instead of Typert RPC

Constraint C1. The alternative — registering our namespace from
`dsh-api-remotes`, or adding an entry to its forwarded-event allowlist — means
patching first-party packages, which a plugin must not require.

`ctx.webServer` is the sanctioned plugin route registry, and the panel is
same-origin. The cost is that we own transport concerns the RPC layer would have
handled: request guarding, error envelopes, and refresh. The benefit is a plugin
that works on a stock harness and can be verified with `curl`.

Consequence for the UI: **there are no push events.** The controller refreshes
from (a) an immediate refetch after every mutation, (b) a 5s poll while the panel
is active, (c) a refetch on panel activation, and (d) a 2s log tail while the
Logs tab is open. Refresh is cheap because the payloads are small and there is no
model-visible effect from either the poll or the refetch.

### 4.3 Request guarding

The route lives at `/mcp-studio-api`, outside `/api`, so it neither depends on
nor weakens the harness's browser-trust fence. On top of that:

- loopback bind is the harness default;
- the `x-mcp-studio: 1` header is mandatory — it is not a secret, its job is to
  force a CORS preflight so a random page cannot drive the API with a simple
  cross-origin POST;
- a request carrying an `Origin` that is not this exact host is rejected;
- `Sec-Fetch-Site` is rejected unless it is `same-origin` or `none`;
- the body is capped at 1 MiB and the method name is checked against an
  **allowlist**, so the endpoint cannot be used to call arbitrary object methods.

## 5. Data model and storage

`src/shared/contract.ts` is the frozen interface: `ServerConfig`, `ServerView`,
`ServerDraft`, `CatalogEntry`, `ProbeResult`, `RuntimeReport`, `LogEntry`,
`McpStudioApi`. Host and client both import it; neither may invent a field.

Two files under `$DSH_HOME/mcp-studio/` (default `~/.dsh/mcp-studio`):

- `servers.json` — non-secret configuration. Human-readable and portable.
- `secrets.json` — secret values only, written with a tightened ACL on Windows.
  The browser only ever sees **names**.

A value is a literal, `${env:NAME}`, or `${secret:NAME}`, and the forms may be
embedded (`Authorization: Bearer ${secret:TOKEN}`). Resolution happens host-side
at mount time; an unresolved name produces a message naming the missing value
rather than an opaque SDK error.

## 6. Catalog

Two sources, merged, curated first:

1. **Curated** (`catalog-data.ts`) — a hand-verified offline set with correct
   `npx -y` / `uvx` invocations and declared inputs. Works with no network.
2. **Official MCP registry** — `GET https://registry.modelcontextprotocol.io/v0.1/servers`,
   keyless. Forms are rendered from `server.json`'s own
   `environmentVariables[]` / `arguments[]` (`isSecret`, `isRequired`,
   `format: filepath`, `default`, `placeholder`), not from bespoke per-server UI.

Any registry failure — offline, changed shape, pre-GA churn — degrades to
curated-only and reports `registryOnline: false` with the reason. The catalog is
never the reason a page fails to render.

## 7. Consent and trust

The MCP specification requires that a client offering one-click local server
configuration implement a proper consent mechanism before executing commands.
MCP Studio therefore:

- shows the **exact, untruncated** command line that will run, built from the
  draft — no ellipsis, no partial path;
- labels it plainly as code that will run on this machine with the user's
  permissions;
- obtains an explicit click before the first connection of a given definition;
- never passes user input through a shell: the bridge spawns with an argument
  vector, and neither the catalog nor the store ever interpolates into a shell
  string.

Secrets are entered as secrets, stored in the secret file, and referenced from
`servers.json` as `${secret:NAME}`. Rotating or deleting a secret is refused
while a server still references it, so a deletion cannot silently break a server.

## 8. Known limits of v0.1

- Remote OAuth is not implemented; a remote server needing a browser flow is a
  manual entry with a pasted token.
- Secrets are protected by file location plus ACL, not by the OS keychain. This
  is weaker than Credential Manager and is called out in the README; a keychain
  backend is the first v0.2 item.
- Tool descriptions are shown as the server reports them. Pinning a hash of each
  tool definition and re-prompting when it changes — the defence against a
  "rug pull" after a server update — is designed but **not** in v0.1.
- No push events (see §4.2), so the panel is up to 5s stale while idle.
- Four catalog entries (`github`, `linear`, `cloudflare`, `neon`) authenticate
  with `Authorization: Bearer <token>`. The draft builder can emit
  `${secret:NAME}` for a whole value but has no per-input constant prefix, so
  those entries currently ask the user to paste the token **including** the
  `Bearer ` prefix. Correct but clumsy; a one-field `prefix` on `CatalogInput`
  is the v0.2 fix. The alternative — interpolating `Bearer ${secret:NAME}` —
  already works end-to-end in `resolve.ts`, which expands placeholders anywhere
  in a value; only the catalog template is missing the field.
