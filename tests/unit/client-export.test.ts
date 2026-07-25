import { describe, expect, it } from 'vitest';
import { buildClientExport } from '@/features/clients/domain/export';
import { EMPTY_PREFERENCES } from '@/features/clients/domain/preferences';

const baseClient = {
  name: 'Ana Silva',
  phone: '+351911111111',
  email: null,
  firstSeenAt: '2026-01-01T10:00:00.000Z',
  preferences: EMPTY_PREFERENCES,
  privateNotes: '',
};

describe('buildClientExport', () => {
  it('stamps the export time and passes client fields through unchanged', () => {
    const now = new Date('2026-07-25T12:00:00.000Z');
    const result = buildClientExport({ now, client: baseClient, appointments: [], photos: [] });

    expect(result.exportedAt).toBe('2026-07-25T12:00:00.000Z');
    expect(result.client).toEqual(baseClient);
    expect(result.appointments).toEqual([]);
    expect(result.photos).toEqual([]);
  });

  it('prefers final_total_cents over expected_total_cents when the appointment is closed', () => {
    const result = buildClientExport({
      now: new Date(),
      client: baseClient,
      appointments: [
        {
          start_at: '2026-06-01T14:00:00.000Z',
          status: 'completed',
          expected_total_cents: 3000,
          final_total_cents: 3500,
          appointment_items: [{ description: 'Verniz Gel' }],
          payments: [{ method: 'cash', status: 'paid' }],
        },
      ],
      photos: [],
    });

    expect(result.appointments[0]).toEqual({
      date: '2026-06-01T14:00:00.000Z',
      status: 'completed',
      services: ['Verniz Gel'],
      totalEuros: 35,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
    });
  });

  it('falls back to expected_total_cents when the appointment never closed', () => {
    const result = buildClientExport({
      now: new Date(),
      client: baseClient,
      appointments: [
        {
          start_at: '2026-08-01T14:00:00.000Z',
          status: 'confirmed',
          expected_total_cents: 2000,
          final_total_cents: null,
          appointment_items: [],
          payments: [],
        },
      ],
      photos: [],
    });

    expect(result.appointments[0]?.totalEuros).toBe(20);
    expect(result.appointments[0]?.paymentMethod).toBeNull();
    expect(result.appointments[0]?.paymentStatus).toBeNull();
  });

  it('lists every service on a multi-item appointment', () => {
    const result = buildClientExport({
      now: new Date(),
      client: baseClient,
      appointments: [
        {
          start_at: '2026-06-01T14:00:00.000Z',
          status: 'completed',
          expected_total_cents: 5000,
          final_total_cents: 5000,
          appointment_items: [{ description: 'Manicure' }, { description: 'Pedicure' }],
          payments: [{ method: 'mbway', status: 'paid' }],
        },
      ],
      photos: [],
    });

    expect(result.appointments[0]?.services).toEqual(['Manicure', 'Pedicure']);
  });

  it('reduces a photo row to just kind and date, dropping storage paths/ids', () => {
    const result = buildClientExport({
      now: new Date(),
      client: baseClient,
      appointments: [],
      photos: [{ kind: 'before', created_at: '2026-05-01T09:00:00.000Z' }],
    });

    expect(result.photos).toEqual([{ kind: 'before', addedAt: '2026-05-01T09:00:00.000Z' }]);
  });
});
