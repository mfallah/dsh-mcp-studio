/**
 * Placeholder resolution for MCP server env vars and HTTP headers.
 *
 * Two placeholder forms are accepted anywhere inside a value:
 *
 *   `${env:NAME}`     read from the process environment
 *   `${secret:NAME}`  read from the plugin's own secret store
 *
 * They may stand alone (`"${secret:GITHUB_TOKEN}"`) or be embedded in a longer
 * literal (`"Bearer ${secret:GITHUB_TOKEN}"`), because the embedded form is what
 * real MCP servers ask for in an `Authorization` header.
 *
 * Resolution NEVER throws. A missing name is collected into the report so the
 * caller can show the user exactly which value to fill in, instead of failing a
 * connection with an opaque error from deep inside the MCP SDK.
 *
 * @module @mfallah/dsh-mcp-studio/host/resolve
 */
import type { ResolutionReport } from '../shared/contract.js'

/** The two lookup sources a placeholder can read from. */
export interface ResolveContext {
  env: NodeJS.ProcessEnv
  secrets: { get(name: string): string | undefined }
}

/** One resolved value map plus what could not be resolved. */
export interface ResolvedMap {
  values: Record<string, string>
  report: ResolutionReport
}

const PLACEHOLDER = /\$\{(env|secret):([A-Za-z0-9._-]{1,64})\}/g

/** Every placeholder name appearing in one value, in order of appearance. */
export function placeholdersIn(value: string): Array<{ kind: 'env' | 'secret'; name: string }> {
  const found: Array<{ kind: 'env' | 'secret'; name: string }> = []
  for (const match of value.matchAll(PLACEHOLDER)) {
    const kind = match[1]
    const name = match[2]
    if ((kind === 'env' || kind === 'secret') && name !== undefined) found.push({ kind, name })
  }
  return found
}

/** True when a value contains at least one placeholder. */
export function hasPlaceholder(value: string): boolean {
  PLACEHOLDER.lastIndex = 0
  return PLACEHOLDER.test(value)
}

/**
 * Replace every placeholder in one value.
 * @param value - the configured value, literal or templated.
 * @param context - environment and secret lookups.
 * @param missing - accumulator for unresolvable names, mutated in place.
 * @returns the expanded value; unresolved placeholders are left verbatim so the
 *   failure is visible in a log line rather than silently becoming empty text.
 */
export function expandValue(
  value: string,
  context: ResolveContext,
  missing: { env: Set<string>; secret: Set<string> },
): string {
  return value.replace(PLACEHOLDER, (whole, kind: string, name: string) => {
    if (kind === 'env') {
      const found = context.env[name]
      if (found === undefined) {
        missing.env.add(name)
        return whole
      }
      return found
    }
    const found = context.secrets.get(name)
    if (found === undefined) {
      missing.secret.add(name)
      return whole
    }
    return found
  })
}

/**
 * Expand a whole env or headers map.
 * @param input - the configured map; `undefined` reads as empty.
 * @param context - environment and secret lookups.
 * @returns resolved values plus the report the UI renders.
 */
export function resolveMap(
  input: Record<string, string> | undefined,
  context: ResolveContext,
): ResolvedMap {
  const missing = { env: new Set<string>(), secret: new Set<string>() }
  const values: Record<string, string> = {}
  for (const [key, raw] of Object.entries(input ?? {})) {
    values[key] = typeof raw === 'string' ? expandValue(raw, context, missing) : String(raw)
  }
  const missingEnv = [...missing.env].sort()
  const missingSecrets = [...missing.secret].sort()
  return {
    values,
    report: {
      ok: missingEnv.length === 0 && missingSecrets.length === 0,
      missingEnv,
      missingSecrets,
    },
  }
}

/** Human-readable one-liner for a resolution failure, used in logs and probes. */
export function describeMissing(report: ResolutionReport): string {
  const parts: string[] = []
  if (report.missingEnv.length > 0) {
    parts.push(`environment variable(s): ${report.missingEnv.join(', ')}`)
  }
  if (report.missingSecrets.length > 0) {
    parts.push(`secret(s): ${report.missingSecrets.join(', ')}`)
  }
  return parts.length > 0 ? `missing ${parts.join(' and ')}` : ''
}

/** Secret NAMES referenced by a map, without expanding anything. */
export function secretNamesIn(input: Record<string, string> | undefined): string[] {
  const names = new Set<string>()
  for (const raw of Object.values(input ?? {})) {
    if (typeof raw !== 'string') continue
    for (const ref of placeholdersIn(raw)) {
      if (ref.kind === 'secret') names.add(ref.name)
    }
  }
  return [...names].sort()
}

/** Whether any value in a map references the secret store. */
export function usesSecrets(input: Record<string, string> | undefined): boolean {
  return secretNamesIn(input).length > 0
}

/**
 * A display-safe copy of an env or header map.
 *
 * Secret-backed values keep their placeholder (it names the secret, never its
 * value). A value whose KEY looks like a credential but that is a plain literal
 * is masked, because the store may hold a value the user pasted in by accident.
 * Everything else is shown as-is: a command-line environment is not secret by
 * default and hiding it would make the settings pane useless.
 */
export function redactMap(input: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(input ?? {})) {
    if (typeof value !== 'string') {
      out[key] = '••••••••'
      continue
    }
    if (hasPlaceholder(value)) {
      out[key] = value
      continue
    }
    out[key] = /key|token|secret|password|passwd|auth|credential/i.test(key) ? '••••••••' : value
  }
  return out
}
