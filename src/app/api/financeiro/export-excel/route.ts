import { NextResponse } from 'next/server';
import { formatInTimeZone } from 'date-fns-tz';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { isFinanceView, resolvePeriod } from '@/features/finance/domain/period';
import { buildFinanceWorkbook } from '@/features/finance/domain/xlsx-export';
import { loadFinanceTransactions } from '@/features/finance/transactions-lookup';
import { logFinanceExport } from '@/features/finance/log-export';
import { errorMessage, logEvent } from '@/lib/logger';
import { getRequestId } from '@/lib/request-id';

// NEX-133: "Exportar Excel" — same period-resolution/auth boundary as the CSV export
// (NEX-132, api/financeiro/export/route.ts); only the output format differs.
export async function GET(request: Request) {
  const { tenantId } = await requireProfile();
  const requestId = await getRequestId();
  const supabase = await createClient();

  const url = new URL(request.url);
  const viewParam = url.searchParams.get('view') ?? undefined;
  const view = isFinanceView(viewParam) ? viewParam : undefined;
  const fromKey = url.searchParams.get('from') ?? undefined;
  const toKey = url.searchParams.get('to') ?? undefined;

  // NEX-171: see api/financeiro/export/route.ts for why requireProfile() stays
  // outside this block.
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
    const workbook = buildFinanceWorkbook(rows, timezone);
    const buffer = await workbook.xlsx.writeBuffer();
    await logFinanceExport(supabase, 'xlsx', period.view, period.range.dateKeys.length, requestId);

    logEvent('info', 'finance.export.succeeded', { tenantId, format: 'xlsx' }, requestId);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="financeiro-${period.dateKey}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logEvent(
      'error',
      'finance.export.failed',
      { tenantId, format: 'xlsx', message: errorMessage(error) },
      requestId,
    );
    return NextResponse.json(
      { error: 'Não foi possível gerar a exportação.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
