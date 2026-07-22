export type AppointmentSummary = {
  id: string;
  clientName: string;
  clientPhoneE164: string | null;
  startAtMs: number;
  endAtMs: number;
  status: string;
  itemDescriptions: string[];
  totalCents: number;
};

export type DashboardSummary = {
  nextAppointment: AppointmentSummary | null;
  todayCount: number;
  pendingRemindersCount: number;
  receivedTodayCents: number;
  invoicedTodayCents: number;
  pendingTodayCents: number;
  pendingPaymentsTodayCount: number;
};

const ACTIVE_STATUSES = new Set(['confirmed', 'presence_confirmed']);

// NEX-080: "Próxima cliente aparece em destaque" (docs/02_UX_FLOWS.md, Fluxo C) — pure
// aggregation over data the page already queried tenant-scoped, so this has no DB
// access of its own and stays trivially testable without Supabase. `nowMs` is a
// parameter (not Date.now() called internally) so a test can assert "next" deterministically
// against a fixed clock.
export function buildDashboardSummary(
  appointmentsToday: readonly AppointmentSummary[],
  pendingRemindersCount: number,
  receivedTodayCents: number,
  pendingTodayCents: number,
  nowMs: number,
  pendingPaymentsTodayCount = 0,
): DashboardSummary {
  const upcoming = appointmentsToday
    .filter((appointment) => ACTIVE_STATUSES.has(appointment.status) && appointment.endAtMs > nowMs)
    .sort((a, b) => a.startAtMs - b.startAtMs);

  const active = appointmentsToday.filter((appointment) => ACTIVE_STATUSES.has(appointment.status));

  return {
    nextAppointment: upcoming[0] ?? null,
    todayCount: active.length,
    pendingRemindersCount,
    receivedTodayCents,
    invoicedTodayCents: active.reduce((sum, appointment) => sum + appointment.totalCents, 0),
    pendingTodayCents,
    pendingPaymentsTodayCount,
  };
}
