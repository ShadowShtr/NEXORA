import { describe, expect, it } from 'vitest';
import { severityForErrorCode } from '@/lib/metrics';
import type { AppErrorCode } from '@/lib/result';

// NEX-171: "Métricas e alertas" — required "alert test". This mapping IS the alert
// definition (see src/lib/metrics.ts) — every AppErrorCode is covered explicitly so a
// future addition to the union can't silently fall through un-classified.
describe('severityForErrorCode', () => {
  it('classifies INTERNAL_ERROR as error — the only alert-worthy severity', () => {
    expect(severityForErrorCode('INTERNAL_ERROR')).toBe('error');
  });

  it.each<AppErrorCode>([
    'VALIDATION_ERROR',
    'UNAUTHENTICATED',
    'FORBIDDEN',
    'NOT_FOUND',
    'SLOT_TAKEN',
    'IDEMPOTENCY_CONFLICT',
    'RATE_LIMITED',
  ])('classifies %s as warn — expected, already-handled outcome', (code) => {
    expect(severityForErrorCode(code)).toBe('warn');
  });
});
