import type { SupabaseClient } from '@supabase/supabase-js';
import type { FinancePeriod } from './domain/period';

// Shared by every export format (CSV/NEX-132, Excel/NEX-133, PDF/NEX-134) so they can
// never compute a different transaction list for the same period — same reasoning as
// computeAvailableSlotsMs (src/lib/availability-lookup.ts) being shared across the
// booking flows that need "available slots".
export type FinanceTransactionRow = Readonly<{
  completedAtIso: string;
  clientName: string;
  serviceDescriptions: readonly string[];
  paymentMethod: 'cash' | 'mbway' | null;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  amountCents: number;
  extrasCents: number;
  discountCents: number;
}>;

type AppointmentItemRow = {
  source_type: string;
  description: string;
  unit_price_cents: number;
  quantity: number;
};

export async function loadFinanceTransactions(
  supabase: SupabaseClient,
  tenantId: string,
  period: FinancePeriod,
): Promise<FinanceTransactionRow[]> {
  const { data } = await supabase
    .from('appointments')
    .select(
      'completed_at, clients(name), payments(method, status, amount_cents), appointment_items(source_type, description, unit_price_cents, quantity)',
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .gte('completed_at', period.range.startIso)
    .lt('completed_at', period.range.endIso)
    .order('completed_at');

  return (data ?? []).map((appointment) => {
    const client = Array.isArray(appointment.clients)
      ? appointment.clients[0]
      : appointment.clients;
    const payment = Array.isArray(appointment.payments)
      ? appointment.payments[0]
      : appointment.payments;
    const items = (appointment.appointment_items ?? []) as AppointmentItemRow[];

    const serviceDescriptions = items
      .filter((item) => item.source_type === 'service' || item.source_type === 'package')
      .map((item) => item.description);
    const extrasCents = items
      .filter((item) => item.source_type === 'manual_extra')
      .reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0);
    const discountCents = items
      .filter((item) => item.source_type === 'discount')
      .reduce((sum, item) => sum + Math.abs(item.unit_price_cents * item.quantity), 0);

    return {
      completedAtIso: appointment.completed_at!,
      clientName: client?.name ?? '',
      serviceDescriptions,
      paymentMethod: payment?.method ?? null,
      paymentStatus: payment?.status ?? 'pending',
      amountCents: payment?.amount_cents ?? 0,
      extrasCents,
      discountCents,
    };
  });
}
