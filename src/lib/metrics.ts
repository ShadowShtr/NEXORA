import type { AppErrorCode } from './result';
import type { LogLevel } from './logger';

// NEX-171: "Métricas e alertas." This is the alerting contract this task defines,
// given there's no external alerting service to provision (CLAUDE.md: "Não
// introduzir Redis, filas ou serviços externos sem necessidade demonstrada") — a
// future log-drain-based alert (Vercel's own, or whatever the dona sets up later)
// filters on `level`, so the mapping from this app's own shared error vocabulary
// (src/lib/result.ts) to a log level *is* the alert definition: `error` is what
// should page someone, `warn` is an expected, already-handled business outcome
// (wrong password, slot already taken, rate limited) that's still worth counting for
// rate/trend metrics, not worth waking anyone up over a single occurrence.
export function severityForErrorCode(code: AppErrorCode): LogLevel {
  return code === 'INTERNAL_ERROR' ? 'error' : 'warn';
}
