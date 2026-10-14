# DEBUG — MCP Studio renders a blank white page

**Cause: CONFIRMED and reproduced.**

`apply()` handed the raw `ctx.locale` service to the slot framework as part of its
`inject` face. That service's `subscribe` / `getSnapshot` are **`this`-dependent
prototype methods**, and `useSyncExternalStore` invokes `subscribe` as a **bare
function**. So `this` was `undefined` the moment React subscribed — on the
panel's first commit — and the panel went to a white page.

One line is responsible, in the pre-fix bundle (`src/client/index.ts` at
`c01a62e`):

```js
const face = { controller, locale: ctx.locale };
```

The failing frame is React calling the detached method:

```
TypeError: Cannot read properties of undefined (reading 'listeners')
    at subscribe (…/LocaleRuntime.subscribe)
    at subscribeToStore (react-dom.development.js:16139:10)
    at commitHookEffectListMount (react-dom.development.js:23189:26)
    at commitPassiveMountOnFiber (react-dom.development.js:24970:11)
```

Fix in the working tree, verified below: [src/client/face.ts](src/client/face.ts)
binds the two methods through arrow wrappers, and
[src/client/panel/McpStudioPage.tsx](src/client/panel/McpStudioPage.tsx)
memoises a store that calls `locale.subscribe(listener)` with the service as
receiver.

Date: 2026-10-14 · Harness author: `client-repro` · React under test: **18.3.1**
(pinned by this repo; `@deepseek-ai/dsh-web-frontend` devDependencies carry
`react@^18.2.0` / `react-dom@^18.2.0`).

---

## 1. The decisive A/B

`node tests/e2e/probe-ab-this-binding.mjs` — verbatim, full capture in
`tests/e2e/ab-this-binding-verbatim.txt`.

Both rows use the same loader harness, call the **real `apply(ctx)`**, compose
props exactly as `dsh-client-ui-renderer/lib/client.js:763-769` does, and render
whatever component the plugin registered in `main`. `ctx.locale` is a
prototype-method face — the real `LocaleRuntime` shape from
`@deepseek-ai/dsh-client-locale/lib/client.js:1194, 1260-1265`:

```js
listeners = new Set()
subscribe(fn) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
```

```
==============================================================================
A/B — prototype-method ctx.locale (real LocaleRuntime shape)
==============================================================================

### PRE-FIX  (git c01a62e:lib/client.js)
    bundle      : F:\harness\dsh-mcp-studio\tests\e2e\old-client.js
    applyError  : none
    renderError : TypeError: Cannot read properties of undefined (reading 'listeners')
    windowErrors: TypeError: Cannot read properties of undefined (reading 'listeners')
    consoleErr  : Error: Uncaught [TypeError: Cannot read properties of undefined (reading 'listeners')] | The above error occurred in the <McpStudioPanel> component:
    htmlLength  : 0   <-- WHITE PAGE
    htmlHead    :

### CURRENT  (working tree lib/client.js)
    bundle      : F:\harness\dsh-mcp-studio\lib\client.js
    applyError  : none
    renderError : none
    windowErrors: none
    consoleErr  : none
    htmlLength  : 3479
    htmlHead    : <div class="mcp-studio" dir="rtl" lang="fa"><header class="mcp-header"><div class="mcp-header-titles"><h1>title<
```

Full pre-fix stack, untruncated:

```
TypeError: Cannot read properties of undefined (reading 'listeners')
    at subscribe (file:///F:/harness/dsh-mcp-studio/tests/e2e/probe-ab-this-binding.mjs:68:10)
    at subscribeToStore (F:\harness\dsh-mcp-studio\node_modules\.pnpm\react-dom@18.3.1_react@18.3.1\node_modules\react-dom\cjs\react-dom.development.js:16139:10)
    at commitHookEffectListMount (…\react-dom.development.js:23189:26)
    at commitPassiveMountOnFiber (…\react-dom.development.js:24970:11)
    at commitPassiveMountEffects_complete (…\react-dom.development.js:24930:9)
    at commitPassiveMountEffects_begin (…\react-dom.development.js:24917:7)
    at commitPassiveMountEffects (…\react-dom.development.js:24905:3)
    at flushPassiveEffectsImpl (…\react-dom.development.js:27078:3)
    at flushPassiveEffects (…\react-dom.development.js:27023:14)
    at …\react-dom.development.js:26808:9
```

`subscribeToStore` calling `subscribe` directly is the load-bearing frame: React
holds the function value `props.locale.subscribe` with no receiver, so the
prototype method's `this` is `undefined` and `this.listeners` throws. The error
lands in a passive effect rather than during render, which is why the shell's
root unmounts and every pixel goes white instead of the failed subtree alone.

### Why the stand-in hid this, and how it was corrected

My earlier locale stand-in closed over its own `Set`:

```js
// WRONG for this predicate: cannot observe a lost `this`
getSnapshot: () => current,
subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
```

A closure over `listeners` behaves identically whether or not it is called as a
method, so it **cannot** reproduce a detached-method bug. I labelled that
stand-in "faithful to `LocaleRuntime`"; for the `this`-binding predicate it was
not. The corrected probe uses `class ProtoLocale` with `this.listeners`,
`this.snapshot`, `this.dicts` and prototype `register` / `addLanguage` / `bind` /
`getSnapshot` / `subscribe`, and reproduces on the pre-fix bundle on the first
run.

**My earlier top-line "NONE on the current build" was a false negative caused by
that stand-in.** It is retracted here rather than dropped. Its eliminations
(§4) remain valid only for the predicates they actually exercised; specifically
the H1 analysis ran under the same stand-in and must be read with that caveat,
though §4's H1 conclusion is independently supported by `probe-usesync.mjs` and
`probe-h1-on-panel.mjs`, which do not involve the locale stand-in's binding
behaviour at all.

### Scope note: both harnesses go through `apply`

Every row in both this A/B and the earlier matrix obtains its component from the
registry that the plugin's own `apply(ctx)` populated, then calls
`entry.options.inject()` to build props. Nothing ever imports `McpStudioPanel`
directly. That matters: rendering the component directly with a hand-made props
object would bypass `inject: () => face` — the exact boundary that broke — and
would have shown a clean render regardless of the defect.

---

## 2. How to run everything

All commands run from the repo root `F:\harness\dsh-mcp-studio`. Node 22, no
install step; `jsdom` comes from the repo's own `node_modules`.

```bash
# THE reproducer: pre-fix vs current bundle through the real apply(), with a
# prototype-method locale face
node tests/e2e/probe-ab-this-binding.mjs

# Main harness: real lib/client.js + real apply(ctx) + real renderer composition
node tests/e2e/blank-panel-repro.mjs

# Hypothesis matrix (A–I)
node tests/e2e/blank-panel-matrix.mjs

# Which uSES getSnapshot shape white-screens React 18.3.1
node tests/e2e/probe-usesync.mjs

# Same two shapes through the REAL built McpStudioPanel
node tests/e2e/probe-h1-on-panel.mjs

# apply() against the REAL SlotCore from @deepseek-ai/dsh-client-ui-slots
node tests/e2e/probe-real-slots.mjs

# Which snapshot field a child dereferences when it throws
node tests/e2e/probe-catalogtab.mjs
```

`tests/e2e/old-client.js` is the pre-fix bundle, extracted with
`"C:\Program Files\Git\cmd\git.exe" show c01a62e:lib/client.js` (redo it through
`[System.IO.File]::WriteAllText` with a UTF-8 no-BOM encoder — PowerShell's `>`
redirection writes UTF-16 and corrupts the file).

Verbatim captures: `ab-this-binding-verbatim.txt`, `usesync-verbatim.txt`,
`matrix-verbatim.txt`. Sidecar JSON: `blank-panel-repro.out.json`,
`blank-panel-matrix.out.json`.

### What the harness wires

| Piece | What is loaded |
| --- | --- |
| Envelope | Real `window.__ModuleLoader__.load({ id, factory })`; factory registry, memoised lazy-CJS `require(id)` that recurses, bootstrap that evaluates the bundle verbatim |
| Plugin | The real built `lib/client.js` (`@mfallah/dsh-mcp-studio`) — or `old-client.js` from `c01a62e` for the pre-fix row |
| React | The repo's real `react` / `react-dom`, one instance: the loader delegates native specifiers to Node's `require`, so `react-dom` sees the same copy the bundle does |
| `ctx.slots` | **Stand-in.** `inject` drains a generator contribution; `register` records `(options, component)`. `@deepseek-ai/dsh-client-ui-slots` publishes only the pure `SlotCore`, not the runtime Service that owns `inject` — see §5 |
| `ctx.locale` | In the A/B: a **prototype-method class** matching the real `LocaleRuntime`. In `blank-panel-repro.mjs`: a labelled closure stand-in |
| `ctx.layout`, `ctx.effect` | Stand-ins |
| `fetch` | Stubbed to the host route's documented envelope, `{ ok: true, value }` (`src/host/http.ts:18`), **not** JSON-RPC, with real per-method shapes |
| Props | `{ ...kit, ...injected, ...slotInjected.props, ...ownerProps }` exactly as `dsh-client-ui-renderer/lib/client.js:763-769`; `kit.t` is the locale seat (`:715-725`), `injected` is `inject: () => face` |

---

## 3. The fix, and the current build's behaviour

[src/client/index.ts](src/client/index.ts) now calls
`createStudioFace({ controller, locale: ctx.locale })`, and
[src/client/face.ts](src/client/face.ts) wraps both methods:

```ts
const getSnapshot = (): { active: string } => locale.getSnapshot()
const subscribe = (listener: () => void): (() => void) => locale.subscribe(listener)
return { controller, locale: { getSnapshot, subscribe } }
```

`locale.subscribe(listener)` keeps the service as receiver, so a prototype method
behaves the same detached or not, and the wrappers are created once per face so
their identity is stable (a fresh closure per render would resubscribe every
render — `dsh-client-ui-renderer/lib/client.js:547-558` documents the same
constraint for its own face).

`useDirection` also memoises the store and now guards the type
([src/client/panel/McpStudioPage.tsx](src/client/panel/McpStudioPage.tsx)):

```ts
const active: unknown = useSyncExternalStore(
  store?.subscribe ?? NO_SUBSCRIBE,
  () => store?.getSnapshot().active ?? 'en',
  () => 'en',
)
return typeof active === 'string' && (active.startsWith('fa') || active.startsWith('ar')) ? 'rtl' : 'ltr'
```

Current bundle, same A/B conditions: `renderError none`, `windowErrors none`,
`consoleErr none`, `htmlLength 3479`, `dir="rtl" lang="fa"`.
`blank-panel-repro.mjs` (closure stand-in, valid host route) also renders clean:
`err: null | htmlLen: 3836`, zero console errors.

---

## 4. Eliminations, and what each one actually rules out

`htmlLength: 0` plus an uncaught error is the white page.

| # | Claim | Verdict |
| --- | --- | --- |
| **H1** | uSES gets a `getSnapshot` returning a new object → React throws "should be cached" | **Mechanism real, but a different bug and not this one.** Confirmed independently of the locale stand-in: an uncached **object** value warns, loops 54 renders, throws `Maximum update depth exceeded`, `html=""` (`probe-usesync.mjs`). The plugin returns a **string** (`active`), so it never triggers; driven through the real built component both shapes render 3479 chars (`probe-h1-on-panel.mjs`). The real locale also returns one frozen snapshot (`dsh-client-locale/lib/client.js:1216-1252`) |
| **H2** | `subscribe` / `getSnapshot` passed unbound → thrash | **This is the confirmed cause, reached from the opposite direction.** Originally recorded as "not the cause" because `McpStudioController`'s pair are class-property arrows (`src/client/state.ts:237, 240`) — that part is still true. But the *locale* face's pair are prototype methods, and forwarding `ctx.locale` put them unbound into props. My earlier "eliminated" applied only to the controller, and I over-extended it |
| **H3** | `locale.getSnapshot().active` is not a string | **Eliminated.** `LocaleSnapshot.active` is a `LocaleId` string (`dsh-client-locale/lib/client.js:1216-1217, 1250-1252`, `lib/types/client/index.d.ts`). The synthetic object-`active` variant does blank the page (matrix row F), so the failure mode is real but its precondition is false. The current build additionally guards this path |
| **H4** | a required prop is missing (`controller` / `t` / `locale`) | **Eliminated for `controller` and `t`; benign for `locale`.** The renderer merges `kit` (with `t` from the entry's `locale: LOCALE_NS` seat) and the `inject` face (`dsh-client-ui-renderer/lib/client.js:715-725, 763-769`, `runInject` `:415-421`). Rows H/I show the page *would* blank if either were dropped, but nothing drops them. `locale` absent is survivable — and is a separate defect, see §6 |
| **H5** | a child (RuntimeBanner, CatalogTab, Tabs, Button, Overlay, CodeBlock) throws on a real-shaped snapshot | **Not reproduced.** With the host's documented empty shapes every child renders. `CatalogTab` has a real crash path — `categories.length` / `categories.map` at `lib/client.js:1835-1837` throw on `undefined` (`src/client/panel/CatalogTab.tsx:31, 96, 101`); `loadCategories` is the only writer (`src/client/state.ts:723-732`), the initial snapshot sets `categories: []` (`:188`) and both success and `catch` assign an array, so it needs a producer of `undefined`. Not produced by any documented host shape — but see §7, which *is* such a producer |
| **H6** | renders fine but empty tree → CSS | **Ruled out in the direction it names.** The tree is not empty (3479 chars) and `ensureStudioStyles()` injects the stylesheet on `apply` and on mount (`src/client/index.ts:34`, `McpStudioPage.tsx:59-63`) |

Also ruled out by the matrix: a **missing or refusing backend is not this bug**.
`/mcp-studio-api/rpc` falling through to the SPA shell (200 `text/html`) renders
2432 chars of error state; `ok: false` renders 2398 chars. Both survive.

---

## 5. Harness false positives found and removed

Three now — each would otherwise have been reported as the cause. Recorded so
they are not re-derived:

1. **Calling the component as a plain function.** `Comp(props)` instead of
   `createElement(Comp, props)` runs the component outside React's dispatcher and
   yields `Cannot read properties of null (reading 'useSyncExternalStore')` with
   `html=""`. Fixed with `React.createElement`.
2. **Stubbing `fetch` with a JSON-RPC envelope.** Returning
   `{ jsonrpc, id, result }` makes `rpc.ts` return `payload.value` = `undefined`
   (`lib/client.js:596`), so `catalogCategories()` resolves `undefined`,
   `state.categories` becomes `undefined`, and `CatalogTab` throws
   `Cannot read properties of undefined (reading 'length')` at
   `lib/client.js:1837` with `html=""`. The route's real envelope is
   `{ ok, value }` (`src/host/http.ts:18`). Kept as a candidate in §7.
3. **A closure-based locale stand-in.** Cannot observe a lost `this`, and so
   produced the false negative that this section exists to correct. Fixed in
   `probe-ab-this-binding.mjs` with `class ProtoLocale`.

---

## 6. Real, separate, low-severity defect (not fixed here)

When `locale` is absent, `useDirection` falls back to `'en'` and the panel renders
`dir="ltr" lang="en"` — matrix row G, `htmlLength 3479`, no error. A Persian user
whose locale face failed to arrive would get a silently LTR, English-direction
panel rather than a visible problem. Kept in the report intentionally; the lead
owns whether to fix it.

---

## 7. Residual suspects, ranked

1. **A re-enveloping proxy or stale bundle.** If anything between the browser and
   the host returns a JSON-RPC-shaped body, the panel blanks via the §5-2 path
   with an empty tree and this stack — worth a `curl` against
   `/mcp-studio-api/rpc` from the same origin to confirm the body is `{ok,value}`.
2. **Stale installed copy.** The shell loads the prebuilt `lib/client.js`; a
   profile still holding the `c01a62e` build reproduces the confirmed bug exactly.
   Comparing the profile's copy against this checkout settles it.
3. **Renderer-side dispatch.** `layout`'s `MainPanel` renders
   `renderSlot("main", {}, { entryKey: activePanelId })`
   (`dsh-client-ui-layout/lib/client.js:116-118`) and `layout.selectPanel` throws
   `main panel "mcp-studio" is not registered` (`:463`). The sidebar icon renders
   independently of the `main` registration, so an icon that appears while the
   main entry is unregistered also shows a blank panel with no error. Not this
   bug — the A/B proves the panel itself crashed — but it is the next thing to
   rule out if a white page is ever seen on a build that carries the fix.

---

## 8. One-line summary

`inject: () => face` forwarded `{ controller, locale: ctx.locale }`, putting
`LocaleRuntime.subscribe` — a prototype method reading `this.listeners` — into
props unbound; `useSyncExternalStore` calls `subscribe` bare, `this` was
`undefined`, and the panel's first commit threw inside a passive effect and
unmounted the root. Pre-fix: `htmlLength 0`, `TypeError: Cannot read properties of
undefined (reading 'listeners')` at `subscribeToStore`. Current build, same
conditions: `htmlLength 3479`, zero errors.
