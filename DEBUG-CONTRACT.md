# DEBUG-CONTRACT — client contract forensics for the blank MCP Studio panel

**Author:** `client-forensics` (evidence only; no source edits).
**Symptom under investigation:** `@mfallah/dsh-mcp-studio` is enabled in the DSH web GUI; its
sidebar icon appears; selecting it shows a blank page with no data.

## 0. Where the evidence actually lives (correction to the task brief)

The reference path in the brief does **not** exist:

- `C:\Users\abz19\.dsh\profiles\node_modules\@deepseek-ai\dsh-client-ui-plugin-manager\lib\client.js` — **not found**
  (`C:\Users\abz19\.dsh\profiles\node_modules\@deepseek-ai\` contains no `*-plugin-manager` and no `*-ui-slots`).
- The installed profile is `C:\Users\abz19\.dsh\profiles\web\`; `@mfallah/dsh-mcp-studio` there is a **junction**
  to `F:\harness\dsh-mcp-studio`, so the code the browser loads *is* the committed `lib/client.js` in this repo.
- The real reference implementation shipped with this harness is in the DSH checkout:
  `C:\Users\abz19\AppData\Local\npm-cache\_npx\1e7f6d9597241db0\node_modules\@deepseek-ai\`.

All reference line numbers below are in that checkout. `PMC` = `dsh-client-ui-plugin-manager/lib/client.js`;
`R` = `dsh-client-ui-renderer/lib/client.js`; `S` = `dsh-client-ui-slots`; `L` = `dsh-client-ui-layout`;
`LOC` = `dsh-client-locale`.

Our built bundle `F:\harness\dsh-mcp-studio\lib\client.js` is byte-for-byte equivalent to `src/client/`
for every contract checked (registration at `lib/client.js:3357-3385`, `useDirection` at `lib/client.js:3253-3263`),
so the src citations below are also the shipped behaviour. I verified this by reading both.

## 1. Contract table

| # | Contract | Ours (file:line) | Reference / declared contract (file:line) | Verdict | Why it would produce a blank page |
|---|---|---|---|---|---|
| 1 | `ctx.slots.inject(name, cb)` accepts a **generator** callback and iterates it | `src/client/index.ts:52-57` (`function* () { yield ctx.slots.register(...) }`); built `lib/client.js:3372-3377` | `PMC:3712-3768` uses the *identical* generator form; `PMC:3703-3711` and `PMC:3769-3775` use a plain disposer-returning callback. Cordis iterates generators: `cordis/lib/index.js:1143-1153` (`Symbol.iterator in effect` → `iter.next()` → `safeCollect`). Slots documents it: `S/README.md:60`, `R:1333-1341` ("creates one disposer **or an iterable of disposers**") | **MATCH** | None. Both return shapes are legal; if the generator were *not* iterated the registration would never commit — but cordis does iterate it, and the identical reference form works. |
| 2a | `ctx.slots.register(options, Component)` option set for a keyed `main` entry | `src/client/index.ts:53-56`: `{ name, key, locale, inject }` | `PMC:3718-3754`: `{ name, key, locale, store, inject, children }`. `main` is declared `kind:'keyed', scope:'root'` with **no `owner`, no `keyProps`** (`L/types/client/index.d.ts:53-56`) | **MATCH (missing members are optional)** | None. Register validation only requires `name` + `key` for keyed (`S/lib/index.js:175-178`); `children`/`store` are conditional spreads (`S/lib/index.js:214-217`). |
| 2b | Renderer tolerance of a **missing `store`** | no `store` passed (`index.ts:54`) | `R:726-731`: `host.storeOf(entry)` returns `undefined` when `entry.store` is undefined → `kit` simply has no `useStore`/`actions`. Our component never reads them (`McpStudioPage.tsx:54`) | **MATCH** | None. |
| 2c | Does `locale: NS` alone produce a `t` prop? | `locale: LOCALE_NS` (`index.ts:54`) + destructured `t` (`McpStudioPage.tsx:54`) | Yes: `R:721-725` `if (entry.locale !== void 0) kit["t"] = localeSeat(face, entry.locale)`. Declared: `S/lib/types/index.d.ts:78-81` (`PropsLocale<N>` = `{ t }`) | **MATCH** | None. (The locale face is guaranteed present: our plugin lists `locale` in `inject`, `index.ts:26`.) |
| 3 | `inject` semantics: how the return value becomes props, stability, missing members | `index.ts:50` `const face = { controller, locale: ctx.locale }`; `inject: () => face` (`index.ts:54`) | `R:415-422` `runInject(entry, binding, actions)` calls `inject(...args)`; `R:479-486` `cachedRootInject` memoises **per entry** (WeakMap), so the face is materialised once; `R:763-769`/`772-777` spread `{...kit, ...injected, ...slotInjected.props, ...ownerProps}` | **MATCH** | None. Our arrow returns the same object identity every call, and the renderer caches anyway. Missing/undefined members are simply absent props — no throw. |
| 4a | `useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)` with "unbound" methods | `McpStudioPage.tsx:55` | Both are **arrow class fields**, i.e. own bound properties: `state.ts:236-245` (`readonly getSnapshot = () => this.snapshot`, `readonly subscribe = (listener) => {...}`) | **MATCH** | None. The brief's premise ("UNBOUND methods") is wrong for the controller; `this` is captured lexically. |
| 4b | `useDirection` passes `ctx.locale.subscribe` **unbound** to `useSyncExternalStore` | `McpStudioPage.tsx:39-46`, specifically **line 41**: `locale?.subscribe ?? NO_SUBSCRIBE` | Every shipped consumer binds the source first: `R:156-157` `const subscribe = (fn) => w.subscribe(fn)` with the explicit comment "**also re-binds `this` for method-based sources**"; `R:547-558` `subscribe: (fn) => face.subscribe(fn)` (locale face, cached per face identity). `LocaleRuntime.subscribe`/`getSnapshot` are **prototype methods using `this`**: `LOC/lib/client.js:1250-1252`, `1260-1265` (`this.listeners.add`); the service is provided raw: `LOC/lib/client.js:1526` `ctx.provide("locale", locale)`. The reference page never receives `ctx.locale` at all: `PMC/lib/types/client/PluginManagerPage.d.ts:16-18` declares only `PropsRuntime/PropsLocale/PropsRenderSlots/InjectFace/PropsStore`; `PMC:3702` builds a purpose-made face | **MISMATCH** | `useSyncExternalStore` invokes `subscribe(cb)` as a **bare call**, so `this` is `undefined`; `this.listeners.add(fn)` throws `TypeError: Cannot read properties of undefined (reading 'listeners')` on mount (verified with Node against the same method shape). |
| 4c | Is `LocaleSnapshot.active` a string? Is the reference's read shape right? | `McpStudioPage.tsx:42` `() => locale?.getSnapshot().active ?? 'en'` | `LOC/lib/types/client/index.d.ts:49-56`: `active: LocaleId` (string), `locales`, `revision: number`. `getSnapshot()` returns a frozen, referentially stable snapshot (`LOC/lib/client.js:1250-1252`, `1443-1448`) | **MATCH (shape)** | None on its own. The *value* is correct; only the *subscribe binding* is broken. NOTE: `getSnapshot` is invoked as `locale.getSnapshot()` (method call) so `this` is fine there. |
| 5 | Props contract for the `main` slot | consumes `{ t, controller, locale }` (`McpStudioPage.tsx:30-34`, `54`) | `PropsRuntime<'main'>` (`S/lib/types/index.d.ts:222`) = `{}` owner & key props, slot-level inject `{}`, plus `ScopeStandardProps<'root'>` = `GlobalStandardProps`; layout merges exactly one member, `usePanelInfo` (`L/types/client/index.d.ts:29-32`). Layout dispatches `renderSlot("main", {}, { entryKey: activePanelId ?? "conversation" })` (`L/lib/client.js:117-118`) | **MATCH** | None. Nothing in the declared main contract is *required*; `usePanelInfo` is optional to consume. `controller`/`locale` arrive legitimately through the inject face; `t` through `locale:`. |
| 6 | CSS / `:root` scope — can `styles.ts` paint the page WHITE? | `src/client/styles.ts` (whole file). Background rules: `.mcp-studio { background: var(--mcp-bg) }` (`styles.ts:40`) with `--mcp-bg: var(--dsw-surface-base, #14161a)` (`styles.ts:19`); every other selector is an `.mcp-*` class only our JSX emits; the only wildcard is `.mcp-studio *` (`styles.ts:46`); overlays use `rgba(4,6,9,.6)` (`styles.ts:205`) and sheets use `var(--mcp-bg)` (`styles.ts:213`) | n/a (our file only) | **NO WHITE** | Explicitly: **no**. There is no `body`, `html`, `:root`, `*` (unscoped) or `.mcp-studio`-on-root rule. The one broad background is scoped to `.mcp-studio` and falls back to `#14161a` (dark). `color-mix()` fallbacks and `--dsw-*` fallbacks are dark. Importantly, when the panel crashes nothing from this sheet is even mounted. |
| 7 | Module-level (import-time) side effects that could throw browser-only | `styles.ts:314-322` (`ensureStudioStyles` guards `doc?.head`; only called inside `apply`, `index.ts:34`, and on panel mount, `McpStudioPage.tsx:60`); `rpc.ts:74-77` (reads `globalThis.fetch` **at call time**, not import); `state.ts:136-142` (`defaultClock` = lazy arrows); `secrets.ts`/`draft.ts` pure | n/a (our files) | **NOT EVIDENCED** | No import-time `window`/`document`/`localStorage`/`fetch` touch anywhere in `src/client/`. `apply` itself runs to completion (proof: the sidebar entry registered *after* the `main` inject, `index.ts:59-64`, and its icon is visible). |

**Sidebar entry (context, not a listed contract):** ours `{ name:'sidebar.panellist', id: PANEL_ID, order: 5, label: () => t('panel'), locale }`
(`index.ts:59-64`) vs reference `{ name, id, order: 0, label: () => t('panel'), locale }` (`PMC:3769-3775`) — **MATCH**;
only `order` differs, which cannot blank the page.

## 2. What the blank page actually is (mechanism)

For a **keyed** `main` entry the renderer wraps every occupant in a per-entry error boundary and **abdicates**
the entry when it crashes:

- `R:611-625` — `SlotErrorBoundary`: catches non-`SlotAssemblyError` errors, `console.error("slot entry crashed in '<key>':", error)`,
  then renders `<div data-slot-error="main" />`;
- `R:1113-1117` — `onEntryError` → `host.reportEntryError(slotKey, entry, error, { abdicate: spec.kind !== 'chain' })`;
- `R:1153-1156` — keyed dispatch then finds no entry for `entryKey` and returns `opts.fallback ?? null`;
- `L/lib/client.js:118` — the layout passes **no fallback** for `main`.

So the expected end state is an **empty centre column** (plus a `console.error` naming `slot entry crashed in 'main'`),
not necessarily a pure-white viewport. A *fully* white page would require the error to escape the boundary;
`getDerivedStateFromError` only rethrows `SlotAssemblyError` (`R:613-615`), which our code cannot construct.
I therefore rate "crash on mount" **high confidence** and "why it looks white rather than empty/dark"
**medium confidence / partly NOT EVIDENCED** — the only renderer-neutral background is the app frame's own CSS
(not in our code), and the theme presenter sets `color-scheme: dark` (`L/lib/client.js:534`) while projecting
tokens onto `document.body` (`L/lib/client.js:536-545`) without setting a body background itself.

## 3. Most likely root cause, ranked

1. **`ctx.locale`'s unbound `subscribe` is handed to `useSyncExternalStore`.**
   `TypeError: Cannot read properties of undefined (reading 'listeners')` fires on the panel's mount effect,
   the entry crashes and is abdicated, and the main slot renders nothing.
   **Single line to change:** `F:\harness\dsh-mcp-studio\src\client\panel\McpStudioPage.tsx:41` —
   replace `locale?.subscribe ?? NO_SUBSCRIBE` with a binding cached per face, mirroring `R:547-558`:
   `useMemo(() => (locale ? (fn: () => void) => locale.subscribe(fn) : NO_SUBSCRIBE), [locale])`
   (a bare inline arrow would also work but would resubscribe on every render).
   *Confidence: high (source-level, both sides cited; every shipped consumer binds it).*

2. **The `inject` face smuggles a live cordis service (`ctx.locale`) into component props at all.**
   This is the design divergence that made (1) possible: the reference's face is a purpose-built object
   (`PMC:3702`) and its page type has no `locale` prop (`PluginManagerPage.d.ts:16-18`); ours is
   `{ controller, locale: ctx.locale }` (`index.ts:50`). Even after (1), the panel subscribes to the locale
   face by hand instead of using the framework's `t` seat, so any future unbound-method read reintroduces the crash.
   **Single line that would have to change:** `F:\harness\dsh-mcp-studio\src\client\index.ts:50` —
   drop `locale: ctx.locale` from the face and derive direction from the already-injected `t`/`usePanelInfo`
   (or keep it, but bind at the face: `locale` wrapping the two methods).
   *Confidence: medium — this is a real contract divergence, but it is the enabler of (1), not an independent blank-page cause.*

3. **Not the cause (checked and cleared): missing `store`/`children`, generator `inject`, main props, CSS, import-time side effects.**
   Each of these is a plausible-looking suspicion that the evidence *refutes*: `R:726-731` (no store),
   `cordis/lib/index.js:1146-1153` (generator iterated), `L/types/client/index.d.ts:53-56` (no required main props),
   `styles.ts:19,40,46` (dark, scoped), `styles.ts:314-322` + `rpc.ts:76-77` (lazy). No line needs to change.
   *Confidence: high that these are NOT the root cause.*

## 4. Insufficient evidence / explicitly NOT EVIDENCED

- **The exact white pixel** and whether the crash escapes the renderer boundary: NOT EVIDENCED from static analysis.
  Falsifiable in one step: open DevTools and read the **first** console error when the panel is selected.
  Expected if rank 1 is right: `slot entry crashed in 'main': TypeError: Cannot read properties of undefined (reading 'listeners')`
  plus `Uncaught (in promise)`-free logs.
- **Whether the host RPC route `/mcp-studio-api/rpc` exists** (`rpc.ts:16`) — out of client scope; a missing route
  would produce per-view error state blocks *with the header still rendered*, so it cannot explain a header-less blank page.
- **Whether any other plugin also registers `main` with key `mcp-studio`** — not checked; would surface as a
  load-time duplicate-key throw (`S/lib/index.js:177-178`), which would have aborted `apply` and hidden the sidebar icon.
