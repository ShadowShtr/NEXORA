import { NextResponse } from 'next/server';
import { formatInTimeZone } from 'date-fns-tz';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { isFinanceView, resolvePeriod } from '@/features/finance/domain/period';
import { buildFinanceTransactionsCsv } from '@/features/finance/domain/csv-export';
import { loadFinanceTransactions } from '@/features/finance/transactions-lookup';
import { logFinanceExport } from '@/features/finance/log-export';
import { errorMessage, logEvent } from '@/lib/logger';
import { getRequestId } from '@/lib/request-id';

// NEX-132: "Exportar CSV" for the financeiro dashboard's currently-viewed period
// (NEX-130/131) — a GET route rather than a Server Action so a plain <a> download link
// works without client JS, same shape as the public booking flow's calendar.ics export
// (api/bookings/[token]/calendar.ics). requireProfile() redirects to /login for an
// unauthenticated request, same as every dashboard page; tenantId comes only from the
// caller's own session, never from the query string, so this can only ever export the
// owner's own tenant's data.
export async function GET(request: Request) {
  const { tenantId } = await requireProfile();
  const requestId = await getRequestId();
  const supabase = await createClient();

  const url = new URL(request.url);
  const viewParam = url.searchParams.get('view') ?? undefined;
  const view = isFinanceView(viewParam) ? viewParam : undefined;
  const fromKey = url.searchParams.get('from') ?? undefined;
  const toKey = url.searchParams.get('to') ?? undefined;

  // NEX-171: "Métricas e alertas" — this route had no try/catch at all before: any
  // failure below (query, CSV build) surfaced as a bare, unlogged 500 from the
  // framework. requireProfile() stays outside this block on purpose — it can throw
  // Next.js's own internal redirect (a real redirect, not a failure) on an
  // unauthenticated request, which a catch here would otherwise misreport as an
  // export failure.
  try {
    const { data: settings } = await supabase
      .from('business_settings')
      .select('timezone')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const timezone = settings?.timezone ?? 'Europe/Lisbon';
    const todayKey = formatInTimeZone(Date.now(), timezone, 'yyyy-MM-dd');
    const period = resolvePeriod(view, fromKey, toKey, todayKey, timezone);

    const rows = await loadFinanceTransactions(supabase, tenantId, period);
    const csv = buildFinanceTransactionsCsv(rows, timezone);
    await logFinanceExport(supabase, 'csv', period.view, period.range.dateKeys.length, requestId);

    logEvent('info', 'finance.export.succeeded', { tenantId, format: 'csv' }, requestId);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="financeiro-${period.dateKey}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logEvent(
      'error',
      'finance.export.failed',
      { tenantId, format: 'csv', message: errorMessage(error) },
      requestId,
    );
    return NextResponse.json(
      { error: 'Não foi possível gerar a exportação.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
