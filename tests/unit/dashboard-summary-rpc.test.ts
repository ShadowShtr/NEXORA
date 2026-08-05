import { describe, expect, it } from 'vitest';
import {
  dashboardSummaryRpcSchema,
  mapAppointmentsToday,
  mapAttentionReminders,
} from '@/features/dashboard/domain/summary-rpc';

// PR4 (docs/audits/NEXORA_PERFORMANCE_AUDIT.md, PR4 update): pure unit coverage for the
// get_dashboard_summary_v1 RPC's client-side contract — schema validation and the
// snake_case (SQL) -> camelCase (UI) mapping. No Supabase involved; the RPC's own SQL
// correctness (aggregation, row-multiplication, tenant isolation) is covered by
// tests/integration/get-dashboard-summary-rpc.test.ts instead, which needs a real
// Postgres.
describe('dashboardSummaryRpcSchema', () => {
  const validPayload = {
    appointments_today: [
      {
        id: '11111111-1111-4111-8111-111111111111',
        start_at: '2026-06-01T09:00:00+00:00',
        end_at: '2026-06-01T09:30:00+00:00',
        status: 'confirmed',
        total_cents: 5000,
        client_name: 'Ana',
        client_phone_e164: '+351912345678',
        item_descriptions: ['Manicure Gel'],
      },
    ],
    attention_reminders: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        due_at: '2026-06-01T10:00:00+00:00',
        appointment_id: '11111111-1111-4111-8111-111111111111',
        appointment_start_at: '2026-06-01T09:00:00+00:00',
        client_name: 'Ana',
        client_phone_e164: '+351912345678',
        item_descriptions: ['Manicure Gel'],
      },
    ],
    pending_reminders_count: 3,
    received_today_cents: 5000,
    pending_today_cents: 1500,
    pending_payments_today_count: 1,
  };

  it('accepts a well-formed RPC payload', () => {
    const result = dashboardSummaryRpcSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('accepts empty arrays and zero counts (no appointments/reminders today)', () => {
    const result = dashboardSummaryRpcSchema.safeParse({
      appointments_today: [],
      attention_reminders: [],
      pending_reminders_count: 0,
      received_today_cents: 0,
      pending_today_cents: 0,
      pending_payments_today_count: 0,
    });
    expect(result.success).toBe(true);
  });

  it('accepts null client_name/client_phone_e164 (a client row could theoretically be missing fields)', () => {
    const result = dashboardSummaryRpcSchema.safeParse({
      ...validPayload,
      appointments_today: [
        { ...validPayload.appointments_today[0], client_name: null, client_phone_e164: null },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects null (an RPC error path the loader must not treat as valid data)', () => {
    const result = dashboardSummaryRpcSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('rejects a payload missing a required field', () => {
    const withoutCount: Partial<typeof validPayload> = { ...validPayload };
    delete withoutCount.pending_reminders_count;
    const result = dashboardSummaryRpcSchema.safeParse(withoutCount);
    expect(result.success).toBe(false);
  });

  it('rejects a negative pending_reminders_count (a shape a buggy RPC change could produce)', () => {
    const result = dashboardSummaryRpcSchema.safeParse({
      ...validPayload,
      pending_reminders_count: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-array appointments_today', () => {
    const result = dashboardSummaryRpcSchema.safeParse({
      ...validPayload,
      appointments_today: 'not-an-array',
    });
    expect(result.success).toBe(false);
  });
});

describe('mapAppointmentsToday', () => {
  it('maps snake_case RPC rows to the AppointmentSummary shape the page renders', () => {
    const mapped = mapAppointmentsToday([
      {
        id: 'a1',
        start_at: '2026-06-01T09:00:00+00:00',
        end_at: '2026-06-01T09:30:00+00:00',
        status: 'confirmed',
        total_cents: 5000,
        client_name: 'Ana',
        client_phone_e164: '+351912345678',
        item_descriptions: ['Manicure Gel'],
      },
    ]);
    expect(mapped).toEqual([
      {
        id: 'a1',
        clientName: 'Ana',
        clientPhoneE164: '+351912345678',
        startAtMs: new Date('2026-06-01T09:00:00+00:00').getTime(),
        endAtMs: new Date('2026-06-01T09:30:00+00:00').getTime(),
        status: 'confirmed',
        itemDescriptions: ['Manicure Gel'],
        totalCents: 5000,
      },
    ]);
  });

  it('falls back client_name to "Cliente" when null, matching the pre-RPC loader', () => {
    const mapped = mapAppointmentsToday([
      {
        id: 'a1',
        start_at: '2026-06-01T09:00:00+00:00',
        end_at: '2026-06-01T09:30:00+00:00',
        status: 'confirmed',
        total_cents: 0,
        client_name: null,
        client_phone_e164: null,
        item_descriptions: [],
      },
    ]);
    expect(mapped[0]!.clientName).toBe('Cliente');
    expect(mapped[0]!.clientPhoneE164).toBeNull();
  });

  it('returns an empty array for an empty input, not an error', () => {
    expect(mapAppointmentsToday([])).toEqual([]);
  });
});

describe('mapAttentionReminders', () => {
  it('maps snake_case RPC rows to the attention-reminder shape the page consumes', () => {
    const mapped = mapAttentionReminders([
      {
        id: 'r1',
        due_at: '2026-06-01T10:00:00+00:00',
        appointment_id: 'a1',
        appointment_start_at: '2026-06-01T09:00:00+00:00',
        client_name: 'Ana',
        client_phone_e164: '+351912345678',
        item_descriptions: ['Manicure Gel'],
      },
    ]);
    expect(mapped).toEqual([
      {
        id: 'r1',
        appointmentId: 'a1',
        clientName: 'Ana',
        clientPhoneE164: '+351912345678',
        startAtMs: new Date('2026-06-01T09:00:00+00:00').getTime(),
        itemDescriptions: ['Manicure Gel'],
      },
    ]);
  });

  it('falls back client_name to "Cliente" when null', () => {
    const mapped = mapAttentionReminders([
      {
        id: 'r1',
        due_at: '2026-06-01T10:00:00+00:00',
        appointment_id: 'a1',
        appointment_start_at: '2026-06-01T09:00:00+00:00',
        client_name: null,
        client_phone_e164: null,
        item_descriptions: [],
      },
    ]);
    expect(mapped[0]!.clientName).toBe('Cliente');
  });
});
