import { NextResponse } from 'next/server';
import { formatInTimeZone } from 'date-fns-tz';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { isFinanceView, resolvePeriod } from '@/features/finance/domain/period';
import {
  buildFinanceTransactionsCsv,
  type FinanceTransactionRow,
} from '@/features/finance/domain/csv-export';

type AppointmentItemRow = {
  source_type: string;
  description: string;
  unit_price_cents: number;
  quantity: number;
};

// NEX-132: "Exportar CSV" for the financeiro dashboard's currently-viewed period
// (NEX-130/131) — a GET route rather than a Server Action so a plain <a> download link
// works without client JS, same shape as the public booking flow's calendar.ics export
// (api/bookings/[token]/calendar.ics). requireProfile() redirects to /login for an
// unauthenticated request, same as every dashboard page; tenantId comes only from the
// caller's own session, never from the query string, so this can only ever export the
// owner's own tenant's data.
export async function GET(request: Request) {
  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const url = new URL(request.url);
  const viewParam = url.searchParams.get('view') ?? undefined;
  const view = isFinanceView(viewParam) ? viewParam : undefined;
  const fromKey = url.searchParams.get('from') ?? undefined;
  const toKey = url.searchParams.get('to') ?? undefined;

  const { data: settings } = await supabase
    .from('business_settings')
    .select('timezone')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const timezone = settings?.timezone ?? 'Europe/Lisbon';
  const todayKey = formatInTimeZone(Date.now(), timezone, 'yyyy-MM-dd');
  const period = resolvePeriod(view, fromKey, toKey, todayKey, timezone);

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

  const rows: FinanceTransactionRow[] = (data ?? []).map((appointment) => {
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

  const csv = buildFinanceTransactionsCsv(rows, timezone);

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="financeiro-${period.dateKey}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
