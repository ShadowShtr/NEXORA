// NEX-170: "Logs estruturados e redaction — Correlation ID e allowlist; sem PII
// sensível." docs/05_SECURITY_PRIVACY.md T8 flagged that this codebase had no
// dedicated redaction mechanism — individual call sites were trusted to just not log
// PII, which is a discipline, not a control. This module is the control: every field
// passed to a log call is either an allowlisted primitive (string/number/boolean/null
// — no nested objects, which could smuggle an entire client/payment record past a
// reviewer skimming the call site) or gets redacted before it ever reaches stdout.
//
// Output is a single JSON line per call to console.log/warn/error — Vercel's log
// pipeline already captures and indexes stdout/stderr as queryable structured logs
// with no extra service to provision (CLAUDE.md: "Não introduzir Redis, filas ou
// serviços externos sem necessidade demonstrada").
export type LogLevel = 'info' | 'warn' | 'error';
export type LogValue = string | number | boolean | null;
export type LogFields = Record<string, LogValue>;

const REDACTED = '[REDACTED]';

// Key-name screen: matches on substring, case-insensitive, so both English and
// Portuguese field names are caught (this codebase's domain vocabulary is PT-PT —
// "telefone", "senha", "morada" — but library/HTTP-layer code tends to use English).
const SENSITIVE_KEY_PATTERN =
  /email|phone|telefone|password|senha|token|secret|segredo|cookie|authoriz|cartao|card|iban|nif|ssn|morada|address|observ|note/i;

// Value-shape screen: catches PII that ended up under an innocuous key name (e.g.
// `identifier: client.email`) — the key allowlist alone can't stop that, only
// inspecting the value can. Deliberately narrow (only shapes that are unambiguously
// PII on their own) to avoid redacting ordinary ids/counts by accident.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_PHONE_SHAPE = /^\+[1-9]\d{7,14}$/;

function looksSensitive(key: string, value: LogValue): boolean {
  // Nothing to protect — redacting it to the string '[REDACTED]' would destroy real
  // information (whether the field was ever set) instead of protecting anything.
  if (value === null) return false;
  if (SENSITIVE_KEY_PATTERN.test(key)) return true;
  if (typeof value !== 'string') return false;
  return EMAIL_SHAPE.test(value) || E164_PHONE_SHAPE.test(value);
}

function redactFields(fields: LogFields): LogFields {
  const safe: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    safe[key] = looksSensitive(key, value) ? REDACTED : value;
  }
  return safe;
}

// Supabase's own errors (PostgrestError, AuthError, StorageError) are plain objects
// with a string `message` property, never actual `Error` instances — `String(error)`
// on one of those gives the useless "[object Object]" instead of the real message, a
// mistake easy to make at every catch-block call site. Centralized here once instead.
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return String(error);
}

const CONSOLE_METHOD: Record<LogLevel, (line: string) => void> = {
  info: (line) => console.log(line),
  warn: (line) => console.warn(line),
  error: (line) => console.error(line),
};

// requestId is optional at the call site — most callers should pass the value from
// getRequestId() (src/lib/request-id.ts) so every log line from the same request can
// be correlated in Vercel's log viewer, but this module doesn't reach into
// next/headers itself: that would make every unit test importing it depend on a
// request context existing, for no benefit (a logger that only works inside a
// request is still useful for e.g. the cron route's non-request-scoped failures).
export function logEvent(
  level: LogLevel,
  event: string,
  fields: LogFields = {},
  requestId?: string | null,
): void {
  // Reserved keys spread last so a field named e.g. "level" or "event" can never
  // shadow the log entry's own — redactFields() runs first, then the fixed envelope
  // wins.
  const entry = {
    ...redactFields(fields),
    timestamp: new Date().toISOString(),
    level,
    event,
    requestId: requestId ?? null,
  };
  CONSOLE_METHOD[level](JSON.stringify(entry));
}
