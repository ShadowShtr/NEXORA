// NEX-095: "Política configurável de faltas" — pure evaluation of the owner's
// configured threshold against a client's no-show history. business_settings stores
// no_show_limit (nullable — null means the policy is off) and no_show_window_days
// (always set, default 90). This is alert-only by product decision: crossing the
// threshold never blocks a booking automatically, it only flags the client so the
// owner can decide case by case (see the "Contagem + aviso visual" option chosen over
// automatic temporary blocking).
export interface NoShowPolicy {
  limit: number | null;
  windowDays: number;
}

export interface NoShowAppointment {
  status: string;
  startAt: string;
}

export function countRecentNoShows(
  appointments: NoShowAppointment[],
  windowDays: number,
  nowMs: number = Date.now(),
): number {
  const windowStartMs = nowMs - windowDays * 24 * 60 * 60 * 1000;
  return appointments.filter(
    (a) => a.status === 'no_show' && new Date(a.startAt).getTime() >= windowStartMs,
  ).length;
}

export function exceedsNoShowLimit(recentNoShowCount: number, policy: NoShowPolicy): boolean {
  if (policy.limit === null) return false;
  return recentNoShowCount >= policy.limit;
}
