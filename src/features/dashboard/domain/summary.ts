export type AppointmentSummary = {
  id: string;
  clientName: string;
  startAtMs: number;
  endAtMs: number;
  status: string;
  itemDescriptions: string[];
};

export type DashboardSummary = {
  nextAppointment: AppointmentSummary | null;
  todayCount: number;
  pendingRemindersCount: number;
  receivedTodayCents: number;
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
  nowMs: number,
): DashboardSummary {
  const upcoming = appointmentsToday
    .filter((appointment) => ACTIVE_STATUSES.has(appointment.status) && appointment.endAtMs > nowMs)
    .sort((a, b) => a.startAtMs - b.startAtMs);

  return {
    nextAppointment: upcoming[0] ?? null,
    todayCount: appointmentsToday.filter((appointment) => ACTIVE_STATUSES.has(appointment.status))
      .length,
    pendingRemindersCount,
    receivedTodayCents,
  };
}
