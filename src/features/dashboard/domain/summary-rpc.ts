import { z } from 'zod';
import type { AppointmentSummary } from './summary';

// PR4 (docs/audits/NEXORA_PERFORMANCE_AUDIT.md, PR4 update): parses and maps the
// jsonb result of the get_dashboard_summary_v1 RPC (supabase/migrations/
// 0039_dashboard_summary_rpc.sql). Zod is used here specifically because this
// project has no generated Supabase `Database` types (confirmed in the PR1 audit —
// no createServerClient<Database> anywhere) — a `jsonb` return type is otherwise
// completely untyped at compile time, unlike every other RPC in this codebase, which
// return a scalar or `void`. This is the first RPC whose shape genuinely needs runtime
// validation, not Zod added for its own sake.
const rpcAppointmentSchema = z.object({
  id: z.uuid(),
  start_at: z.string(),
  end_at: z.string(),
  status: z.string(),
  total_cents: z.number(),
  client_name: z.string().nullable(),
  client_phone_e164: z.string().nullable(),
  item_descriptions: z.array(z.string()),
});

const rpcAttentionReminderSchema = z.object({
  id: z.uuid(),
  due_at: z.string(),
  appointment_id: z.uuid(),
  appointment_start_at: z.string(),
  client_name: z.string().nullable(),
  client_phone_e164: z.string().nullable(),
  item_descriptions: z.array(z.string()),
});

export const dashboardSummaryRpcSchema = z.object({
  appointments_today: z.array(rpcAppointmentSchema),
  attention_reminders: z.array(rpcAttentionReminderSchema),
  pending_reminders_count: z.number().int().nonnegative(),
  received_today_cents: z.number(),
  pending_today_cents: z.number(),
  pending_payments_today_count: z.number().int().nonnegative(),
});

export type DashboardSummaryRpcResult = z.infer<typeof dashboardSummaryRpcSchema>;

export type AttentionReminderData = {
  id: string;
  appointmentId: string | null;
  clientName: string;
  clientPhoneE164: string | null;
  startAtMs: number | null;
  itemDescriptions: string[];
};

// Same field shape/fallbacks the pre-RPC loader's own row mapping used
// (`client?.name ?? 'Cliente'`, `row.final_total_cents ?? row.expected_total_cents`
// — the latter already computed in SQL as `total_cents`, see the migration) — this
// function exists so the page component keeps consuming the exact same
// AppointmentSummary/attention-reminder shapes it already rendered, unchanged.
export function mapAppointmentsToday(
  rows: DashboardSummaryRpcResult['appointments_today'],
): AppointmentSummary[] {
  return rows.map((row) => ({
    id: row.id,
    clientName: row.client_name ?? 'Cliente',
    clientPhoneE164: row.client_phone_e164,
    startAtMs: new Date(row.start_at).getTime(),
    endAtMs: new Date(row.end_at).getTime(),
    status: row.status,
    itemDescriptions: row.item_descriptions,
    totalCents: row.total_cents,
  }));
}

export function mapAttentionReminders(
  rows: DashboardSummaryRpcResult['attention_reminders'],
): AttentionReminderData[] {
  return rows.map((row) => ({
    id: row.id,
    appointmentId: row.appointment_id,
    clientName: row.client_name ?? 'Cliente',
    clientPhoneE164: row.client_phone_e164,
    startAtMs: new Date(row.appointment_start_at).getTime(),
    itemDescriptions: row.item_descriptions,
  }));
}
