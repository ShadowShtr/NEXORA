import Link from 'next/link';
import {
  Bell,
  Clock,
  Download,
  Minus,
  PieChart,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { formatInTimeZone } from 'date-fns-tz';
import type { CalendarRange } from '@/features/appointments/domain/calendar-navigation';
import {
  formatFinanceRangeLabel,
  isFinanceView,
  resolvePeriod,
  resolvePreviousRange,
  summaryTitle,
  type FinancePeriod,
  type FinancePeriodView,
} from '@/features/finance/domain/period';
import {
  buildFinanceSummary,
  computeTrend,
  type CompletedAppointmentItem,
  type CompletedAppointmentRow,
  type FinanceSummary,
  type Trend,
} from '@/features/finance/domain/summary';
import { FinancePeriodSelector } from '@/features/finance/FinancePeriodSelector';
import { RevenueInfoButton } from '@/features/finance/RevenueInfoButton';

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function mapCompletedRows(data: unknown): CompletedAppointmentRow[] {
  const rows = (data ?? []) as Array<{
    payments: unknown;
    appointment_items: Array<{
      source_type: string;
      unit_price_cents: number;
      quantity: number;
    }> | null;
  }>;

  return rows.map((row) => {
    const paymentRow = (Array.isArray(row.payments) ? row.payments[0] : row.payments) as {
      method: 'cash' | 'mbway' | null;
      status: 'pending' | 'paid' | 'refunded';
      amount_cents: number;
    } | null;

    return {
      payment: paymentRow
        ? {
            method: paymentRow.method,
            status: paymentRow.status,
            amountCents: paymentRow.amount_cents,
          }
        : null,
      items: (row.appointment_items ?? []).map((item) => ({
        sourceType: item.source_type as CompletedAppointmentItem['sourceType'],
        unitPriceCents: item.unit_price_cents,
        quantity: item.quantity,
      })),
    };
  });
}

// NEX-130/NEX-131: "Dia/semana/mês, métodos, pendentes, extras, descontos, ticket" +
// "Hoje, semana, mês e personalizado com timezone." Data loading (including the
// Date.now() read) lives outside the component body — see the same purity-rule note in
// src/app/(dashboard)/dashboard/page.tsx (NEX-080).
async function loadFinanceData(
  tenantId: string,
  view: FinancePeriodView | undefined,
  fromKey: string | undefined,
  toKey: string | undefined,
) {
  const supabase = await createClient();

  const [{ data: settings }, { count: pendingRemindersCount }] = await Promise.all([
    supabase.from('business_settings').select('timezone').eq('tenant_id', tenantId).maybeSingle(),
    supabase
      .from('reminders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending'),
  ]);
  const timezone = settings?.timezone ?? 'Europe/Lisbon';

  const nowMs = Date.now();
  const todayKey = formatInTimeZone(nowMs, timezone, 'yyyy-MM-dd');
  const period = resolvePeriod(view, fromKey, toKey, todayKey, timezone);
  const previousRange = resolvePreviousRange(period, timezone);

  const selectCompleted = (range: CalendarRange) =>
    supabase
      .from('appointments')
      .select(
        'payments(method, status, amount_cents), appointment_items(source_type, unit_price_cents, quantity)',
      )
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .gte('completed_at', range.startIso)
      .lt('completed_at', range.endIso);

  const [{ data: currentRows }, { data: previousRows }] = await Promise.all([
    selectCompleted(period.range),
    selectCompleted(previousRange),
  ]);

  const summary = buildFinanceSummary(mapCompletedRows(currentRows));
  const previousSummary = buildFinanceSummary(mapCompletedRows(previousRows));
  const trend = computeTrend(summary.totalCents, previousSummary.totalCents);

  return {
    timezone,
    period,
    summary,
    trend,
    pendingRemindersCount: pendingRemindersCount ?? 0,
  };
}

function TrendBadge({ trend }: { trend: Trend }) {
  if (trend.percent === null) {
    return (
      <span className="revenue-comparison">Sem faturação no período anterior para comparar.</span>
    );
  }
  const Icon =
    trend.direction === 'positive'
      ? TrendingUp
      : trend.direction === 'negative'
        ? TrendingDown
        : Minus;
  return (
    <span className="revenue-comparison">
      <Icon aria-hidden="true" size={15} />
      <span className="revenue-comparison-value" data-trend={trend.direction}>
        {trend.direction === 'positive' ? '+' : trend.direction === 'negative' ? '-' : ''}
        {trend.percent}%
      </span>
      vs período anterior
    </span>
  );
}

function RevenueHeroCard({ summary, trend }: { summary: FinanceSummary; trend: Trend }) {
  return (
    <div className="revenue-hero-card">
      <div className="revenue-card-header">
        <span className="revenue-card-label">
          Total faturado
          <RevenueInfoButton />
        </span>
      </div>
      <p className="revenue-total">{formatEuros(summary.totalCents)}</p>
      {summary.totalCents === 0 ? (
        <span className="revenue-comparison">Sem faturação neste período.</span>
      ) : (
        <TrendBadge trend={trend} />
      )}
    </div>
  );
}

function PaymentBreakdown({ summary }: { summary: FinanceSummary }) {
  return (
    <div className="payment-breakdown">
      <div className="payment-method-card" data-method="cash">
        <span className="payment-method-icon" aria-hidden="true">
          <Wallet size={19} />
        </span>
        <span className="payment-method-name">Dinheiro</span>
        <span className="payment-method-value">{formatEuros(summary.cashCents)}</span>
        <span className="payment-method-percentage">{summary.cashPercent}%</span>
        <span className="payment-progress" aria-hidden="true">
          <span className="payment-progress-fill" style={{ width: `${summary.cashPercent}%` }} />
        </span>
      </div>

      <div className="payment-method-card" data-method="mbway">
        <span className="payment-method-icon" aria-hidden="true">
          <Smartphone size={19} />
        </span>
        <span className="payment-method-name">MB WAY</span>
        <span className="payment-method-value">{formatEuros(summary.mbwayCents)}</span>
        <span className="payment-method-percentage">{summary.mbwayPercent}%</span>
        <span className="payment-progress" aria-hidden="true">
          <span className="payment-progress-fill" style={{ width: `${summary.mbwayPercent}%` }} />
        </span>
      </div>

      <Link
        href="/dashboard/financeiro/pendentes"
        className="payment-method-card"
        data-method="pending"
      >
        <span className="payment-method-icon" aria-hidden="true">
          <Clock size={19} />
        </span>
        <span className="payment-method-name">Pendentes</span>
        <span className="payment-method-value">{formatEuros(summary.pendingCents)}</span>
        <span className="payment-method-percentage">{summary.pendingPercent}%</span>
        <span className="payment-progress" aria-hidden="true">
          <span className="payment-progress-fill" style={{ width: `${summary.pendingPercent}%` }} />
        </span>
      </Link>
    </div>
  );
}

function FinanceSummaryCard({
  period,
  summary,
}: {
  period: FinancePeriod;
  summary: FinanceSummary;
}) {
  return (
    <div className="finance-summary-card">
      <p className="finance-summary-title">{summaryTitle(period.view)}</p>
      <div className="finance-summary-row" data-type="billed">
        <span className="finance-summary-dot" aria-hidden="true" />
        <span className="finance-summary-label">Faturado</span>
        <span className="finance-summary-value">{formatEuros(summary.totalCents)}</span>
      </div>
      <div className="finance-summary-row" data-type="received">
        <span className="finance-summary-dot" aria-hidden="true" />
        <span className="finance-summary-label">Recebido</span>
        <span className="finance-summary-value">{formatEuros(summary.receivedCents)}</span>
      </div>
      <div className="finance-summary-row" data-type="pending">
        <span className="finance-summary-dot" aria-hidden="true" />
        <span className="finance-summary-label">Pendentes</span>
        <span className="finance-summary-value">{formatEuros(summary.pendingCents)}</span>
      </div>
    </div>
  );
}

function FinanceKpisGrid({ summary }: { summary: FinanceSummary }) {
  return (
    <div className="finance-kpis-grid">
      <div className="finance-kpi-card">
        <p className="finance-kpi-value">{summary.appointmentsCount}</p>
        <p className="finance-kpi-label">Atendimentos</p>
      </div>
      <div className="finance-kpi-card">
        <p className="finance-kpi-value">{formatEuros(summary.averageTicketCents)}</p>
        <p className="finance-kpi-label">Ticket médio</p>
      </div>
      <div className="finance-kpi-card">
        <p className="finance-kpi-value">{formatEuros(summary.discountsCents)}</p>
        <p className="finance-kpi-label">Descontos</p>
      </div>
      <div className="finance-kpi-card">
        <p className="finance-kpi-value">{formatEuros(summary.extrasCents)}</p>
        <p className="finance-kpi-label">Extras</p>
      </div>
    </div>
  );
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; from?: string; to?: string }>;
}) {
  const { tenantId } = await requireProfile();
  const params = await searchParams;
  const view = isFinanceView(params.view) ? params.view : undefined;

  const { timezone, period, summary, trend, pendingRemindersCount } = await loadFinanceData(
    tenantId,
    view,
    params.from,
    params.to,
  );

  // Mirrors exactly what's on screen (not the raw, possibly-partial searchParams) so the
  // export always matches the currently-displayed period.
  const exportSearchParams = new URLSearchParams({ view: period.view });
  if (period.view === 'custom') {
    exportSearchParams.set('from', period.range.dateKeys[0]!);
    exportSearchParams.set('to', period.range.dateKeys[period.range.dateKeys.length - 1]!);
  }
  const exportUrl = `/api/financeiro/export?${exportSearchParams.toString()}`;
  const exportExcelUrl = `/api/financeiro/export-excel?${exportSearchParams.toString()}`;

  return (
    <div className="shell finance-page">
      <header className="more-top-header">
        <span className="more-logo">NEXORA</span>
        <Link
          href="/dashboard/lembretes"
          className="notification-button"
          aria-label={
            pendingRemindersCount > 0
              ? `Lembretes (${pendingRemindersCount} pendentes)`
              : 'Lembretes'
          }
        >
          <Bell aria-hidden="true" size={20} />
          {pendingRemindersCount > 0 ? (
            <span className="notification-badge" aria-hidden="true">
              {pendingRemindersCount > 99 ? '99+' : pendingRemindersCount}
            </span>
          ) : null}
        </Link>
      </header>

      <h1 className="more-title">Financeiro</h1>

      <FinancePeriodSelector
        rangeLabel={formatFinanceRangeLabel(period, timezone)}
        view={period.view}
      />

      <RevenueHeroCard summary={summary} trend={trend} />

      <PaymentBreakdown summary={summary} />

      <FinanceSummaryCard period={period} summary={summary} />

      <FinanceKpisGrid summary={summary} />

      <Link href="/dashboard/relatorios" className="full-report-button">
        <PieChart aria-hidden="true" size={19} />
        Ver relatório completo
      </Link>

      <a href={exportUrl} className="full-report-button">
        <Download aria-hidden="true" size={19} />
        Exportar CSV
      </a>

      <a href={exportExcelUrl} className="full-report-button">
        <Download aria-hidden="true" size={19} />
        Exportar Excel
      </a>
    </div>
  );
}
