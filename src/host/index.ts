/**
 * MCP Studio host half — the Cordis plugin the DSH loader mounts.
 *
 * It owns three things and nothing else:
 *
 * 1. a small persisted store of MCP server definitions (`~/.dsh/mcp-studio`),
 * 2. one live `@deepseek-ai/dsh-mcp-client` child plugin per enabled server,
 * 3. a local JSON endpoint (`/mcp-studio-api`) the browser panel calls.
 *
 * It deliberately does NOT write `cordis.patch.yml`. Server definitions live in
 * the plugin's own store so the user's profile layer stays the user's, and a
 * server can be added, tested, disabled and deleted without a restart. The
 * `exportPatch()` method renders the equivalent YAML for anyone who wants to
 * drop the plugin later.
 *
 * Two third-party constraints shaped this design, both verified against the
 * shipped packages rather than assumed:
 * - A module that also exports `default` loses its `inject` metadata, so this
 *   file exports `name`/`Config`/`apply` and no default.
 * - `dsh-api-remotes` fixes its reachable capability set at build time, so the
 *   browser half cannot call a third-party host service over Typert. It uses a
 *   route on `ctx.webServer` instead, which is the documented plugin-facing
 *   extension point for browser-facing features.
 *
 * @module @mfallah/dsh-mcp-studio
 */
import os from 'node:os'
import path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import {
  EVENT_CHANGED,
  type ChangedEvent,
} from '../shared/contract.js'
import { CatalogService } from './catalog.js'
import { ConnectionSupervisor, type ToolSchemaSource } from './connection.js'
import { API_PREFIX, registerApi, type WebServerLike } from './http.js'
import { LogBuffer } from './logs.js'
import { SecretStore } from './secrets.js'
import { McpStudioError, McpStudioService } from './service.js'
import { ServerStore } from './store.js'

/** Plugin name used by loader diagnostics. */
export const name = 'mcp-studio'

/**
 * Version reported to the UI and the health endpoint.
 * Kept in sync with package.json by `tests/host/version.test.ts`.
 */
export const VERSION = '0.1.0'

/** Package name, used in the health response and the export header. */
export const PACKAGE_NAME = '@mfallah/dsh-mcp-studio'

/**
 * Cordis config schema.
 *
 * Every field has a default so the bundle layer in `patch.yml` can mount the
 * plugin with no configuration at all.
 */
export const Config = z.object({
  /** Override the store directory. Empty means `$DSH_HOME/mcp-studio`. */
  storeDir: z.string().default(''),
  /** Query the official MCP registry in addition to the curated catalog. */
  catalogEnabled: z.boolean().default(true),
  /** Registry API base URL. */
  registryUrl: z.string().default('https://registry.modelcontextprotocol.io'),
  /** Budget for a pre-save connection probe. */
  probeTimeoutMs: z.natural().min(1000).max(600_000).default(60_000),
  /** Budget for mounting one real server at startup. */
  mountTimeoutMs: z.natural().min(1000).max(600_000).default(90_000),
  /** Retained log lines per server. */
  logLinesPerServer: z.natural().min(0).max(10_000).default(500),
})

/** Resolved plugin configuration. */
export interface Config {
  storeDir: string
  catalogEnabled: boolean
  registryUrl: string
  probeTimeoutMs: number
  mountTimeoutMs: number
  logLinesPerServer: number
}

/** Methods reachable over the HTTP endpoint. An allowlist, not reflection. */
const RPC_METHODS = new Set<string>([
  'listServers',
  'getServer',
  'addServer',
  'updateServer',
  'removeServer',
  'setEnabled',
  'restartServer',
  'testConnection',
  'getLogs',
  'catalog',
  'catalogCategories',
  'installFromCatalog',
  'detectRuntimes',
  'listSecretNames',
  'setSecret',
  'deleteSecret',
  'resolveConfig',
  'exportPatch',
])

/** Minimal logger shape, so this file does not depend on the logger's type. */
interface MiniLogger {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

/** Use the harness logger when present, console otherwise. */
function createLogger(ctx: Context): MiniLogger {
  const raw = (ctx as unknown as { logger?: (name?: string) => unknown }).logger?.('mcp-studio')
  const call = (level: 'info' | 'warn' | 'error', message: string): void => {
    const fn = (raw as Record<string, unknown> | undefined)?.[level]
    if (typeof fn === 'function') {
      ;(fn as (this: unknown, value: string) => void).call(raw, message)
      return
    }
    // eslint-disable-next-line no-console
    console[level](`[mcp-studio] ${message}`)
  }
  return {
    info: (message) => call('info', message),
    warn: (message) => call('warn', message),
    error: (message) => call('error', message),
  }
}

/** Where the plugin keeps its state by default. */
export function defaultStoreDir(env: NodeJS.ProcessEnv = process.env): string {
  const home = env.DSH_HOME?.trim()
  const base = home !== undefined && home.length > 0 ? home : path.join(os.homedir(), '.dsh')
  return path.join(base, 'mcp-studio')
}

/**
 * Mount MCP Studio.
 *
 * Startup order matters and is deliberate: the stores load first so a corrupt
 * file is reported before anything is served, the HTTP route is registered next
 * so the panel can render a "connecting" row immediately, and only then are the
 * configured servers mounted. A server that fails to connect is reported as a
 * row error and never aborts plugin activation.
 *
 * @param ctx - the plugin context.
 * @param config - validated plugin configuration.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const logger = createLogger(ctx)
  const storeDir =
    typeof config.storeDir === 'string' && config.storeDir.trim().length > 0
      ? config.storeDir.trim()
      : defaultStoreDir()

  const store = new ServerStore({ dir: storeDir })
  const secrets = new SecretStore({ dir: storeDir })
  const storeInit = await store.init()
  const secretInit = await secrets.init()
  for (const warning of [...storeInit.warnings, ...secretInit.warnings]) logger.warn(warning)

  const logs = new LogBuffer({ maxPerServer: config.logLinesPerServer })
  const catalog = new CatalogService({
    registryUrl: config.registryUrl,
    enabled: config.catalogEnabled,
  })

  /** Fire-and-forget notification. A missing listener is not an error. */
  const emit = (event: string, payload: unknown): void => {
    try {
      const emitter = ctx as unknown as { emit?: (name: string, value: unknown) => void }
      emitter.emit?.(event, payload)
    } catch {
      // A notification must never break a completed operation.
    }
  }

  let toolsRef: ToolSchemaSource | undefined

  const supervisor = new ConnectionSupervisor({
    ctx,
    logs,
    resolve: { env: process.env, secrets },
    tools: () => toolsRef,
    mountTimeoutMs: config.mountTimeoutMs,
    onChange: (id) => {
      emit(EVENT_CHANGED, { ids: [id], reason: 'status' } satisfies ChangedEvent)
    },
  })

  const service = new McpStudioService({
    store,
    secrets,
    logs,
    catalog,
    supervisor,
    env: process.env,
    version: VERSION,
    probeTimeoutMs: config.probeTimeoutMs,
    onChange: (ids, reason) => {
      emit(EVENT_CHANGED, { ids, reason } satisfies ChangedEvent)
    },
  })

  // The tool registry arrives after this plugin in every shipped composition,
  // so the reference is captured reactively rather than read at apply time.
  ctx.inject(['tools'], (scoped: Context) => {
    toolsRef = scoped.tools
    logger.info(`tool registry attached; MCP tools will be reported under mcp__<name>__*`)
    return () => {
      toolsRef = undefined
    }
  })

  // The browser panel's only channel to this half.
  ctx.inject(['webServer'], (scoped: Context) => {
    const webServer = (scoped as unknown as { webServer: WebServerLike }).webServer
    const dispose = registerApi(
      webServer,
      async (method, args) => {
        if (!RPC_METHODS.has(method)) {
          throw new McpStudioError('unknown-method', `unknown method "${method}"`)
        }
        const table = service as unknown as Record<string, (...rest: unknown[]) => unknown>
        const fn = table[method]
        if (typeof fn !== 'function') {
          throw new McpStudioError('unknown-method', `method "${method}" is not callable`)
        }
        return await fn.apply(service, args)
      },
      {
        name: PACKAGE_NAME,
        version: VERSION,
        serverCount: () => store.list().length,
      },
    )
    logger.info(`MCP Studio API ready at ${API_PREFIX}`)
    return () => {
      dispose()
    }
  })

  ctx.effect(
    () => () => {
      void supervisor.dispose()
    },
    'mcp-studio: connection teardown',
  )

  await service.mountAll()
  const enabled = store.list().filter((row) => row.enabled).length
  logger.info(
    `${PACKAGE_NAME} v${VERSION} ready — ${store.list().length} server(s) configured, ${enabled} enabled, store ${storeDir}`,
  )
}
