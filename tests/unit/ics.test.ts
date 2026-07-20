import { describe, expect, it } from 'vitest';
import { generateIcsEvent } from '@/lib/ics';

describe('generateIcsEvent', () => {
  it('produces a well-formed VCALENDAR/VEVENT with CRLF line endings', () => {
    const ics = generateIcsEvent({
      uid: 'abc-123@nexora',
      startAtIso: '2026-06-15T09:00:00.000Z',
      endAtIso: '2026-06-15T10:00:00.000Z',
      summary: 'Marcação — Ana',
    });

    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('BEGIN:VEVENT\r\n');
    expect(ics).toContain('END:VEVENT\r\n');
    expect(ics).toContain('VERSION:2.0\r\n');
    // No bare \n anywhere — every line break is \r\n per RFC 5545.
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('emits DTSTART/DTEND in UTC form regardless of the input instant', () => {
    const ics = generateIcsEvent({
      uid: 'abc-123@nexora',
      startAtIso: '2026-06-15T09:00:00.000Z',
      endAtIso: '2026-06-15T10:30:00.000Z',
      summary: 'Test',
    });

    expect(ics).toContain('DTSTART:20260615T090000Z\r\n');
    expect(ics).toContain('DTEND:20260615T103000Z\r\n');
  });

  it('keeps the UID stable and unmodified for the same appointment id', () => {
    const first = generateIcsEvent({
      uid: 'appointment-42@nexora',
      startAtIso: '2026-06-15T09:00:00.000Z',
      endAtIso: '2026-06-15T10:00:00.000Z',
      summary: 'Test',
    });
    const second = generateIcsEvent({
      uid: 'appointment-42@nexora',
      startAtIso: '2026-06-15T09:00:00.000Z',
      endAtIso: '2026-06-15T10:00:00.000Z',
      summary: 'Test (re-download)',
    });

    const extractUid = (ics: string) => ics.match(/UID:(.+)\r\n/)?.[1];
    expect(extractUid(first)).toBe('appointment-42@nexora');
    expect(extractUid(first)).toBe(extractUid(second));
  });

  it('escapes commas, semicolons and backslashes in text fields', () => {
    const ics = generateIcsEvent({
      uid: 'abc@nexora',
      startAtIso: '2026-06-15T09:00:00.000Z',
      endAtIso: '2026-06-15T10:00:00.000Z',
      summary: 'Verniz Gel, Massagem; Extra\\Special',
    });

    expect(ics).toContain('SUMMARY:Verniz Gel\\, Massagem\\; Extra\\\\Special\r\n');
  });

  it('includes LOCATION and DESCRIPTION only when provided', () => {
    const withBoth = generateIcsEvent({
      uid: 'abc@nexora',
      startAtIso: '2026-06-15T09:00:00.000Z',
      endAtIso: '2026-06-15T10:00:00.000Z',
      summary: 'Test',
      description: 'Verniz Gel',
      location: 'Rua Teste 1, 1000-000 Lisboa',
    });
    expect(withBoth).toContain('DESCRIPTION:Verniz Gel\r\n');
    expect(withBoth).toContain('LOCATION:Rua Teste 1\\, 1000-000 Lisboa\r\n');

    const withoutEither = generateIcsEvent({
      uid: 'abc@nexora',
      startAtIso: '2026-06-15T09:00:00.000Z',
      endAtIso: '2026-06-15T10:00:00.000Z',
      summary: 'Test',
    });
    expect(withoutEither).not.toContain('DESCRIPTION:');
    expect(withoutEither).not.toContain('LOCATION:');
  });

  it('folds lines longer than 75 octets with a single leading space on the continuation', () => {
    const longSummary = 'A'.repeat(120);
    const ics = generateIcsEvent({
      uid: 'abc@nexora',
      startAtIso: '2026-06-15T09:00:00.000Z',
      endAtIso: '2026-06-15T10:00:00.000Z',
      summary: longSummary,
    });

    const lines = ics.split('\r\n');
    const summaryLineIndex = lines.findIndex((line) => line.startsWith('SUMMARY:'));
    expect(lines[summaryLineIndex]!.length).toBeLessThanOrEqual(75);
    expect(lines[summaryLineIndex + 1]!.startsWith(' ')).toBe(true);
  });
});
