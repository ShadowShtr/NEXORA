import { NextResponse } from 'next/server';
import { formatInTimeZone } from 'date-fns-tz';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import {
  formatFinanceRangeLabel,
  isFinanceView,
  resolvePeriod,
} from '@/features/finance/domain/period';
import { buildFinancePdf } from '@/features/finance/domain/pdf-export';
import { loadFinanceTransactions } from '@/features/finance/transactions-lookup';
import { logFinanceExport } from '@/features/finance/log-export';
import { errorMessage, logEvent } from '@/lib/logger';
import { getRequestId } from '@/lib/request-id';

// NEX-134: "Exportar PDF" — same period-resolution/auth boundary as the CSV/Excel
// exports (NEX-132/133); only the output format differs.
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
    const buffer = await buildFinancePdf(
      rows,
      timezone,
      'Financeiro',
      formatFinanceRangeLabel(period, timezone),
    );
    await logFinanceExport(supabase, 'pdf', period.view, period.range.dateKeys.length, requestId);

    logEvent('info', 'finance.export.succeeded', { tenantId, format: 'pdf' }, requestId);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="financeiro-${period.dateKey}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logEvent(
      'error',
      'finance.export.failed',
      { tenantId, format: 'pdf', message: errorMessage(error) },
      requestId,
    );
    return NextResponse.json(
      { error: 'Não foi possível gerar a exportação.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
