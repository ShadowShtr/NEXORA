import type { AppointmentCardStatus } from './appointment-card';

// Visual refinement mid-2026 (Detalhes da marcação) — appointment_status has 5 real
// values (0001_initial.sql), not the 4 a generic "confirmed/pending/cancelled/no-show"
// badge design assumes. Mapped here once instead of duplicating a switch per component:
// confirmed/presence_confirmed/completed all read as "nothing wrong" (success/green) —
// completed matches the existing agenda-list convention (.appointment-card-completed,
// globals.css); cancelled stays danger/red; no_show gets its own warning/orange instead
// of being lumped in with cancelled, a more precise distinction than the older list view
// makes (that one only needed muted-vs-danger, not a full palette).
export type BookingBadgeTone = 'success' | 'danger' | 'warning';

const BADGE_TONE_BY_STATUS: Record<AppointmentCardStatus, BookingBadgeTone> = {
  confirmed: 'success',
  presence_confirmed: 'success',
  completed: 'success',
  cancelled: 'danger',
  no_show: 'warning',
};

export function bookingBadgeTone(status: AppointmentCardStatus): BookingBadgeTone {
  return BADGE_TONE_BY_STATUS[status];
}

// "95 min" -> "1 h 35 min" / "45 min" / "2 h" — same rules as the Nova marcação wizard's
// formatDurationLabel (appointment-wizard.ts), duplicated rather than imported: that
// module lives under features/appointments/domain too, but importing across these two
// unrelated features for a three-line pure function isn't worth the coupling.
export function formatDurationLabel(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export type PaymentSummary = {
  status: 'pending' | 'paid' | 'refunded';
  method: 'cash' | 'mbway' | null;
} | null;

const PAYMENT_METHOD_LABELS: Record<'cash' | 'mbway', string> = {
  cash: 'Dinheiro',
  mbway: 'MB WAY',
};

// No payments row exists at all until an appointment is completed (payments are only
// ever inserted by complete_appointment, 0015/0016/0017_complete_appointment*.sql) — a
// still-upcoming appointment has payment === null here, which reads the same as
// "Pendente" to the dona (nothing to collect yet either way).
export function paymentSummaryLabel(payment: PaymentSummary): string {
  if (!payment || payment.status === 'pending') return 'Pendente';
  if (payment.status === 'refunded') return 'Estornado';
  return payment.method ? `Pago (${PAYMENT_METHOD_LABELS[payment.method]})` : 'Pago';
}
