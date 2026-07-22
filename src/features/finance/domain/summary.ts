export type PaymentMethod = 'cash' | 'mbway';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';

export type CompletedAppointmentPayment = {
  method: PaymentMethod | null;
  status: PaymentStatus;
  amountCents: number;
};

export type CompletedAppointmentItem = {
  sourceType: 'service' | 'package' | 'manual_extra' | 'discount';
  unitPriceCents: number;
  quantity: number;
};

export type CompletedAppointmentRow = {
  payment: CompletedAppointmentPayment | null;
  items: readonly CompletedAppointmentItem[];
};

export type FinanceSummary = {
  totalCents: number;
  cashCents: number;
  mbwayCents: number;
  pendingCents: number;
  cashPercent: number;
  mbwayPercent: number;
  pendingPercent: number;
  receivedCents: number;
  appointmentsCount: number;
  averageTicketCents: number;
  extrasCents: number;
  discountsCents: number;
};

// NEX-130: "Dia/semana/mês, métodos, pendentes, extras, descontos, ticket." One
// payment row per completed appointment (complete_appointment always inserts exactly
// one, 0015_complete_appointment.sql), so summing payments.amount_cents directly is
// equivalent to summing appointments.final_total_cents — no need to join back to
// appointments for the total. A 'refunded' payment is excluded from every bucket
// (cash/mbway/pending and therefore totalCents): money paid back out isn't faturado,
// pending, nor received. Nothing in this app can produce a refunded payment yet (no
// refund action exists), so this only guards against a future state, not a case that
// happens today.
export function buildFinanceSummary(rows: readonly CompletedAppointmentRow[]): FinanceSummary {
  let cashCents = 0;
  let mbwayCents = 0;
  let pendingCents = 0;
  let extrasCents = 0;
  let discountsCents = 0;

  for (const row of rows) {
    if (row.payment) {
      if (row.payment.status === 'pending') {
        pendingCents += row.payment.amountCents;
      } else if (row.payment.status === 'paid') {
        if (row.payment.method === 'cash') cashCents += row.payment.amountCents;
        else if (row.payment.method === 'mbway') mbwayCents += row.payment.amountCents;
      }
    }
    for (const item of row.items) {
      const lineCents = item.unitPriceCents * item.quantity;
      if (item.sourceType === 'manual_extra') extrasCents += lineCents;
      else if (item.sourceType === 'discount') discountsCents += Math.abs(lineCents);
    }
  }

  const totalCents = cashCents + mbwayCents + pendingCents;
  const appointmentsCount = rows.length;
  const averageTicketCents = appointmentsCount > 0 ? Math.round(totalCents / appointmentsCount) : 0;
  const percentOf = (part: number) => (totalCents > 0 ? Math.round((part / totalCents) * 100) : 0);

  return {
    totalCents,
    cashCents,
    mbwayCents,
    pendingCents,
    cashPercent: percentOf(cashCents),
    mbwayPercent: percentOf(mbwayCents),
    pendingPercent: percentOf(pendingCents),
    receivedCents: cashCents + mbwayCents,
    appointmentsCount,
    averageTicketCents,
    extrasCents,
    discountsCents,
  };
}

// NEX-114: "Lista, contacto e marcar pago" — the WhatsApp message for following up on
// a pending payment. amountLabel arrives pre-formatted (formatEuros lives with the
// page, not the domain layer), same convention as buildAppointmentReminderMessage
// (appointments/domain/appointment-card.ts) taking an already-formatted time label.
export function buildPendingPaymentMessage(clientName: string, amountLabel: string): string {
  return `Olá ${clientName}! A confirmar o pagamento pendente de ${amountLabel} referente ao seu atendimento.`;
}

export type Trend = {
  direction: 'positive' | 'negative' | 'neutral';
  /** Percent change, rounded to a whole number. Null when there's nothing to compare
   *  against (previous period had zero faturação) — showing "+∞%" would be meaningless. */
  percent: number | null;
};

export function computeTrend(currentCents: number, previousCents: number): Trend {
  if (previousCents === 0) {
    if (currentCents === 0) return { direction: 'neutral', percent: null };
    return { direction: 'positive', percent: null };
  }
  const change = Math.round(((currentCents - previousCents) / previousCents) * 100);
  if (change === 0) return { direction: 'neutral', percent: 0 };
  return { direction: change > 0 ? 'positive' : 'negative', percent: Math.abs(change) };
}
