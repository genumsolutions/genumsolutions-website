/**
 * Structured error reporting — the single seam for every error boundary and
 * unexpected server-side failure (audit item W1/S2).
 *
 * Dependency-free by design: with no DSN configured it buffers reports
 * in-memory (visible in server logs via `flushErrorReports`) and never
 * throws. Wiring a real backend later (e.g. Sentry) means filling in ONLY
 * the `sendToProvider` body — no call-site changes anywhere.
 *
 * Server usage:
 *   import { reportError } from '@/lib/error-reporting'
 *   reportError(err, { route: '/api/orders', userId })
 *
 * Client usage (error.tsx / global-error.tsx): same function; without a
 * public ingest URL it just buffers + logs to the browser console.
 */

export type ErrorReport = {
  message: string
  stack?: string
  digest?: string
  severity: 'error' | 'warning'
  tags: Record<string, string>
  timestamp: string
}

const MAX_BUFFER = 50

/** Module-scoped ring buffer (survives per lambda instance, best-effort). */
const buffer: ErrorReport[] = []

function envUrl(): string | undefined {
  // NEXT_PUBLIC_* so the same module works in client boundaries.
  return process.env.NEXT_PUBLIC_ERROR_REPORTING_URL || undefined
}

function sendToProvider(report: ErrorReport): void {
  const url = envUrl()
  if (!url) return // buffering-only mode
  // Fire-and-forget; reporting must never break the caller.
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
    keepalive: true,
  } as RequestInit).catch(() => {})
}

export function reportError(
  error: unknown,
  context: { digest?: string; tags?: Record<string, string>; severity?: 'error' | 'warning' } = {},
): void {
  const report: ErrorReport = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    digest: context.digest,
    severity: context.severity ?? 'error',
    tags: context.tags ?? {},
    timestamp: new Date().toISOString(),
  }

  buffer.push(report)
  if (buffer.length > MAX_BUFFER) buffer.shift()

  sendToProvider(report)

  // Console keeps local dev + server logs useful with zero configuration.
  // eslint-disable-next-line no-console
  console.error('[error-reporting]', report.message, report.tags, error)
}

/** Expose the buffer (testing / server-log flushing / admin diagnostics). */
export function getRecentErrorReports(): readonly ErrorReport[] {
  return buffer
}

export function clearErrorReports(): void {
  buffer.length = 0
}
