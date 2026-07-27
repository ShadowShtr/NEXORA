import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorMessage, logEvent } from '@/lib/logger';

// NEX-170: "Logs estruturados e redaction — Correlation ID e allowlist; sem PII
// sensível." This is the required "log tests" — the redaction/allowlist behaviour is
// the actual security control here, so it's tested far more thoroughly than a single
// happy-path call.
function lastLoggedEntry(spy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const line = spy.mock.calls.at(-1)?.[0] as string;
  return JSON.parse(line);
}

describe('logEvent', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('routes each level to the matching console method, as a single JSON line', () => {
    logEvent('info', 'test.info');
    logEvent('warn', 'test.warn');
    logEvent('error', 'test.error');

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(() => JSON.parse(logSpy.mock.calls[0][0] as string)).not.toThrow();
  });

  it('includes timestamp, level, event and requestId in every entry', () => {
    logEvent('info', 'booking.created', { tenantId: 'abc-123' }, 'req-42');
    const entry = lastLoggedEntry(logSpy);

    expect(entry).toMatchObject({ level: 'info', event: 'booking.created', requestId: 'req-42' });
    expect(typeof entry.timestamp).toBe('string');
    expect(new Date(entry.timestamp as string).toISOString()).toBe(entry.timestamp);
  });

  it('defaults requestId to null when not provided (no request context)', () => {
    logEvent('info', 'cron.ran');
    const entry = lastLoggedEntry(logSpy);
    expect(entry.requestId).toBeNull();
  });

  it('passes through fields whose keys and values are not PII-shaped', () => {
    logEvent('info', 'booking.created', {
      tenantId: 'tenant-1',
      appointmentId: 'appt-1',
      durationMinutes: 60,
      isReplay: false,
    });
    const entry = lastLoggedEntry(logSpy);

    expect(entry).toMatchObject({
      tenantId: 'tenant-1',
      appointmentId: 'appt-1',
      durationMinutes: 60,
      isReplay: false,
    });
  });

  it.each([
    'email',
    'clientEmail',
    'phone',
    'telefone',
    'phone_e164',
    'password',
    'senha',
    'token',
    'accessToken',
    'secret',
    'segredo',
    'cookie',
    'authorization',
    'cartao',
    'card',
    'iban',
    'nif',
    'morada',
    'address',
    'observation',
    'privateNotes',
  ])('redacts the value of a field whose key name suggests PII/secrets: %s', (key) => {
    logEvent('info', 'test.event', { [key]: 'some real sensitive value' });
    const entry = lastLoggedEntry(logSpy);
    expect(entry[key]).toBe('[REDACTED]');
  });

  it('redacts an email-shaped value even under an innocuous key name', () => {
    logEvent('info', 'test.event', { identifier: 'dona@example.com' });
    const entry = lastLoggedEntry(logSpy);
    expect(entry.identifier).toBe('[REDACTED]');
  });

  it('redacts an E.164-phone-shaped value even under an innocuous key name', () => {
    logEvent('info', 'test.event', { identifier: '+351912345678' });
    const entry = lastLoggedEntry(logSpy);
    expect(entry.identifier).toBe('[REDACTED]');
  });

  it('does not redact an ordinary numeric or short string under an innocuous key name', () => {
    logEvent('info', 'test.event', { identifier: 'appt-01234', count: 3 });
    const entry = lastLoggedEntry(logSpy);
    expect(entry.identifier).toBe('appt-01234');
    expect(entry.count).toBe(3);
  });

  it('reserved envelope keys (level, event, timestamp, requestId) cannot be overridden by a field of the same name', () => {
    logEvent(
      'info',
      'test.event',
      { level: 'FAKE', event: 'FAKE', timestamp: 'FAKE', requestId: 'FAKE' },
      'real-request-id',
    );
    const entry = lastLoggedEntry(logSpy);

    expect(entry.level).toBe('info');
    expect(entry.event).toBe('test.event');
    expect(entry.requestId).toBe('real-request-id');
    expect(entry.timestamp).not.toBe('FAKE');
  });

  it('null values pass through unredacted regardless of key name (nothing to leak)', () => {
    logEvent('info', 'test.event', { email: null });
    const entry = lastLoggedEntry(logSpy);
    expect(entry.email).toBeNull();
  });
});

// Regression: an earlier version of the cron route did `String(error)` on a caught
// Supabase error, which produced the literal text "[object Object]" in the log
// (confirmed against a real failing request) — Supabase's own error types
// (PostgrestError, AuthError, StorageError) are plain objects with a `message`
// property, never real `Error` instances.
describe('errorMessage', () => {
  it('extracts .message from a real Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('extracts .message from a Supabase-style plain error object', () => {
    expect(errorMessage({ message: 'permission denied', code: '42501' })).toBe('permission denied');
  });

  it('falls back to String() for anything without a usable .message', () => {
    expect(errorMessage('a plain string error')).toBe('a plain string error');
    expect(errorMessage({ code: '42501' })).toBe('[object Object]');
    expect(errorMessage(null)).toBe('null');
  });
});
