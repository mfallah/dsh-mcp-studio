/**
 * The single state owner behind the MCP Studio panel.
 *
 * Framework-free on purpose: the controller talks only to a `McpStudioApi`
 * facade (see `rpc.ts`) and a pluggable clock, so the whole behaviour — catalog
 * search, install, probe, log tailing, polling, optimistic-but-honest actions —
 * is testable in plain vitest with a fake host.
 *
 * There are no host events over this transport. Freshness comes from three
 * sources, all owned here:
 *   1. an immediate refetch after every mutation,
 *   2. a cheap `listServers()` poll while the panel is visible,
 *   3. a refetch when the panel becomes visible again.
 * The log tailer polls `getLogs(id, sinceSeq)` while the Logs tab is open.
 *
 * @module @mfallah/dsh-mcp-studio/client/state
 */
import type { CatalogEntry, CatalogQuery, LogEntry, McpStudioApi, ProbeResult, RuntimeReport, ServerDetail, ServerDraft, ServerPatch, ServerView } from '../shared/contract.js';
import { type SecretWrite } from './secrets.js';
/** Tab selected in the page header. */
export type StudioTab = 'catalog' | 'installed';
/** Tab selected inside the server drawer. */
export type DrawerTab = 'tools' | 'logs' | 'settings';
/** Lifecycle of one async view. */
export type LoadPhase = 'idle' | 'loading' | 'ready' | 'error';
/** One async read: its phase, last good value, and failure detail. */
export interface AsyncView<T> {
    phase: LoadPhase;
    value: T;
    /** Human-readable failure from the last attempt, cleared on success. */
    error?: string;
    /** True when the last attempt failed but a previous value is still shown. */
    stale?: boolean;
}
/** Catalog plus the registry-side metadata the page explains in copy. */
export interface CatalogView extends AsyncView<CatalogEntry[]> {
    total: number;
    registryOnline: boolean;
    registryError?: string;
}
/** What the overlay currently shows, if anything. */
export type StudioSelection = {
    kind: 'catalog';
    id: string;
} | {
    kind: 'server';
    id: string;
} | {
    kind: 'manual';
} | null;
/**
 * Every mutable field the controller owns. Views never see this type; they
 * subscribe to {@link StudioSnapshot}, whose collection members are read-only.
 */
export interface StudioState {
    /** Whether the panel is the active main panel (drives polling). */
    visible: boolean;
    tab: StudioTab;
    servers: AsyncView<ServerView[]>;
    catalog: CatalogView;
    catalogQuery: CatalogQuery;
    categories: string[];
    runtimes: AsyncView<RuntimeReport | null>;
    secrets: AsyncView<string[]>;
    selection: StudioSelection;
    drawerTab: DrawerTab;
    detail: AsyncView<ServerDetail | null>;
    logs: LogEntry[];
    logsPhase: LoadPhase;
    logsError?: string;
    probe: AsyncView<ProbeResult | null>;
    patch: AsyncView<string | null>;
    /** Keys with an in-flight action, so rows can disable exactly themselves. */
    busy: Set<string>;
    /** Per-action failure text, rendered inline next to the action. */
    actionErrors: Record<string, string | undefined>;
    /** Monotonic stamp of the last successful server read. */
    serversReadAt?: number;
}
/**
 * The read-only view a component renders from. Collections are exposed as
 * `Readonly*` so no view can mutate controller state by accident.
 */
export type StudioSnapshot = Readonly<Omit<StudioState, 'busy' | 'actionErrors'>> & {
    readonly busy: ReadonlySet<string>;
    readonly actionErrors: Readonly<Record<string, string | undefined>>;
};
/** Busy/error key builders; views and controller share these strings. */
export declare const busyKey: {
    readonly catalog: "catalog";
    readonly servers: "servers";
    readonly runtimes: "runtimes";
    readonly secrets: "secrets";
    readonly patch: "patch";
    readonly probe: "probe";
    readonly install: "install";
    readonly detail: "detail";
    readonly server: (id: string, action: string) => string;
    readonly secret: (name: string) => string;
};
/** Action error keys that are not derived from an id. */
export declare const errorKey: {
    readonly install: "install";
    readonly manual: "manual";
    readonly patch: "patch";
    readonly probe: "probe";
    readonly catalog: "catalog";
    readonly servers: "servers";
    readonly secrets: "secrets";
    readonly runtimes: "runtimes";
};
/** Timer surface, injectable so tests can drive polling deterministically. */
export interface StudioClock {
    now(): number;
    setInterval(handler: () => void, ms: number): number;
    clearInterval(handle: number): void;
}
/** Options accepted by {@link McpStudioController}. */
export interface StudioControllerOptions {
    api: McpStudioApi;
    clock?: StudioClock;
    /** Server poll while visible; defaults to 5s. */
    pollMs?: number;
    /** Log poll while the Logs tab is open; defaults to 2s. */
    logPollMs?: number;
    /** Rolling log cap; defaults to 400 lines. */
    maxLogLines?: number;
}
/** Result of an action the views render inline. */
export interface ActionResult {
    ok: boolean;
    error?: string;
}
/**
 * Result of a catalog install or test.
 *
 * `secretsStored` tells the sheet that the raw secret answers have left the
 * browser for good, so it can replace them in its own state with their
 * `${secret:...}` references.
 */
export interface CatalogOutcome extends ActionResult {
    /** True once every raw secret input was written to the secret store. */
    secretsStored: boolean;
    /** The probe result on the Test path; null when nothing was probed. */
    result: ProbeResult | null;
}
/** Build the pristine state (exported for tests and the page's initial render). */
export declare function createInitialSnapshot(): StudioState;
/**
 * Owns every read and write the panel performs.
 *
 * Views subscribe through {@link subscribe}/{@link getSnapshot}; nothing else
 * holds state. Every mutation re-reads truth from the host on completion, even
 * when it failed, so the UI never drifts from the store.
 */
export declare class McpStudioController {
    private readonly api;
    private readonly clock;
    private readonly pollMs;
    private readonly logPollMs;
    private readonly maxLogLines;
    private readonly listeners;
    private state;
    private snapshot;
    private pollHandle;
    private logHandle;
    private logsSeq;
    private disposed;
    constructor(options: StudioControllerOptions);
    /** Stable getSnapshot for `useSyncExternalStore`. */
    readonly getSnapshot: () => StudioSnapshot;
    /** Stable subscribe for `useSyncExternalStore`. */
    readonly subscribe: (listener: () => void) => (() => void);
    private publish;
    private setBusy;
    private setError;
    /** Whether an action key has an in-flight call. */
    isBusy(key: string): boolean;
    /** Inline failure text for an action key, if the last attempt failed. */
    errorOf(key: string): string | undefined;
    /**
     * Toggle the panel's visibility. Becoming visible triggers a refetch of
     * everything that is stale and starts the cheap server poll; becoming hidden
     * stops every timer.
     * @param visible - whether the panel is the active main panel.
     */
    setVisible(visible: boolean): void;
    /** Manual refresh: reload whichever views the active tab shows. */
    refresh(): Promise<void>;
    /** Stop every timer and drop subscribers. Idempotent. */
    dispose(): void;
    private startPolling;
    private stopPolling;
    private startLogPolling;
    private stopLogPolling;
    /** Load everything the panel can show; failures land per view, never thrown. */
    loadAll(): Promise<void>;
    /**
     * Read every configured server and its live status.
     * @param quiet - true for a poll tick: keep the current list on screen while
     *   re-reading, and mark it stale instead of replacing it with an error.
     */
    loadServers(quiet?: boolean): Promise<void>;
    /**
     * Persist a new server from a draft the caller already resolved.
     *
     * @param draft - the server draft.
     * @param secrets - `{name, value}` pairs to store before the server is added.
     * @returns the outcome; the panel renders `error` inline when `ok` is false.
     */
    install(draft: ServerDraft, secrets?: SecretWrite[]): Promise<ActionResult>;
    /**
     * Install one catalog entry.
     *
     * Order matters and is the whole point of this method: the raw secret answers
     * are written to the secret store first, then the host turns the entry into a
     * draft (a pure transformation that replaces secret inputs with
     * `${secret:<key>}`), then the draft is added. If storing a secret fails, no
     * draft is built and nothing is added.
     *
     * @param entry - the catalog entry being installed.
     * @param values - the input values the user filled in.
     */
    installCatalogEntry(entry: CatalogEntry, values: Record<string, string>): Promise<CatalogOutcome>;
    /**
     * Store secret values one by one, stopping at the first rejection.
     *
     * Public because the manual-add form persists its env/header secrets through
     * this same guarded path before it submits the draft.
     *
     * @param writes - the values to store, in order.
     * @returns `ok: true` once every value is stored (and the name list re-read).
     */
    persistSecrets(writes: SecretWrite[]): Promise<ActionResult>;
    private runInstall;
    /**
     * Probe a draft without persisting it.
     * @param draft - the draft to connect.
     */
    testDraft(draft: ServerDraft): Promise<ProbeResult | null>;
    /**
     * Probe a catalog entry before installing it.
     *
     * Same order as installation: store the raw secret answers first, then let the
     * host build the draft, then connect. A failed secret write stops the flow and
     * is reported through the probe view.
     *
     * @param entry - the catalog entry being tested.
     * @param values - the input values the user filled in.
     */
    testCatalogEntry(entry: CatalogEntry, values: Record<string, string>): Promise<CatalogOutcome>;
    private runProbe;
    /** Enable or disable one server, then re-read the list. */
    toggleServer(id: string, enabled: boolean): Promise<ActionResult>;
    /** Tear down and re-establish one connection, then re-read the list. */
    restartServer(id: string): Promise<ActionResult>;
    /** Save an edit to one server, then re-read the list and detail. */
    saveServer(id: string, patch: ServerPatch): Promise<ActionResult>;
    /** Remove a server; closes the drawer when it was showing that server. */
    removeServer(id: string): Promise<ActionResult>;
    /**
     * Read one server's config and log tail.
     * @param id - server id.
     * @param quiet - true for a poll tick: keep the drawer populated while re-reading.
     */
    loadDetail(id: string, quiet?: boolean): Promise<void>;
    /** Incremental log tail for one server; appends, dedupes by seq, and caps. */
    loadLogs(id: string): Promise<void>;
    /** Drop the rendered log lines (the host ring buffer is untouched). */
    clearLogs(): void;
    /**
     * Read the catalog for the current query.
     * @param quiet - keep the current entries on screen while re-reading.
     */
    loadCatalog(quiet?: boolean): Promise<void>;
    /** Read the category chips once the catalog is known. */
    loadCategories(): Promise<void>;
    /** Merge a catalog query and re-read. */
    setCatalogQuery(patch: CatalogQuery): void;
    /** Read which local executables are available. */
    loadRuntimes(): Promise<void>;
    /** Read the stored secret names (never their values). */
    loadSecrets(): Promise<void>;
    /** Store or replace one secret value. */
    saveSecret(name: string, value: string): Promise<ActionResult>;
    /** Delete one secret by name. */
    removeSecret(name: string): Promise<ActionResult>;
    /** Render the plugin state as a patch insert list. */
    exportPatch(): Promise<ActionResult>;
    /** Switch the top-level tab, loading anything that tab needs. */
    setTab(tab: StudioTab): void;
    /** Open the install sheet for one catalog entry. */
    selectCatalogEntry(id: string | null): void;
    /** Open the drawer for one installed server and start tailing its logs. */
    selectServer(id: string | null): void;
    /** Open the manual-add form. */
    selectManual(): void;
    /** Close whatever overlay is open and stop log tailing. */
    closeSelection(): void;
    /** Switch the drawer tab; starts or stops the log tailer accordingly. */
    setDrawerTab(tab: DrawerTab): void;
    /** The server currently shown in the drawer, when there is one. */
    selectedServer(): ServerView | undefined;
    /** The catalog entry currently shown in the install sheet, when there is one. */
    selectedCatalogEntry(): CatalogEntry | undefined;
    /** Run a quiet re-read of every view the visible tab depends on. */
    reloadVisible(): Promise<void>;
}
