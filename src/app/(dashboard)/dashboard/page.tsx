import Link from 'next/link';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { Bell, Calendar, ChevronRight, CreditCard, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import {
  buildDashboardSummary,
  type AppointmentSummary,
  type DashboardSummary,
} from '@/features/dashboard/domain/summary';

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0]![0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

// Data loading (including the Date.now() read) lives outside the component body: the
// React Compiler purity rule forbids impure calls directly in render, since a component
// must be safely re-callable. This is a plain async function the Server Component
// calls once, not a component itself, so the rule doesn't apply to it.
async function loadDashboardData(tenantId: string) {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from('business_settings')
    .select('timezone')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const timezone = settings?.timezone ?? 'Europe/Lisbon';

  const nowMs = Date.now();
  // "Hoje" is the tenant's own calendar day, not UTC's — fromZonedTime (same helper the
  // availability engine uses, src/features/appointments/domain/daily-schedule.ts)
  // resolves "00:00 local" to the correct UTC instant across a DST boundary.
  const todayKey = formatInTimeZone(nowMs, timezone, 'yyyy-MM-dd');
  const dayStart = fromZonedTime(`${todayKey}T00:00:00`, timezone);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
  const dayStartIso = dayStart.toISOString();
  const dayEndIso = dayEnd.toISOString();

  const [
    { data: appointmentRows },
    { count: pendingRemindersCount },
    { data: paymentRows },
    { count: pendingPaymentsCount },
  ] = await Promise.all([
    supabase
      .from('appointments')
      .select(
        'id, start_at, end_at, status, expected_total_cents, final_total_cents, clients(name), appointment_items(description)',
      )
      .eq('tenant_id', tenantId)
      .gte('start_at', dayStartIso)
      .lt('start_at', dayEndIso)
      .order('start_at'),
    supabase
      .from('reminders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending'),
    supabase
      .from('payments')
      .select('amount_cents')
      .eq('tenant_id', tenantId)
      .eq('status', 'paid')
      .gte('paid_at', dayStartIso)
      .lt('paid_at', dayEndIso),
    supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending'),
  ]);

  const appointmentsToday: AppointmentSummary[] = (appointmentRows ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    return {
      id: row.id,
      clientName: client?.name ?? 'Cliente',
      startAtMs: new Date(row.start_at).getTime(),
      endAtMs: new Date(row.end_at).getTime(),
      status: row.status,
      itemDescriptions: (row.appointment_items ?? []).map((item) => item.description),
    };
  });

  const ACTIVE_STATUSES = new Set(['confirmed', 'presence_confirmed', 'completed']);
  const expectedTodayCents = (appointmentRows ?? [])
    .filter((row) => ACTIVE_STATUSES.has(row.status))
    .reduce((sum, row) => sum + (row.final_total_cents ?? row.expected_total_cents), 0);

  const receivedTodayCents = (paymentRows ?? []).reduce((sum, row) => sum + row.amount_cents, 0);

  const summary = buildDashboardSummary(
    appointmentsToday,
    pendingRemindersCount ?? 0,
    receivedTodayCents,
    nowMs,
  );

  return {
    summary,
    timezone,
    appointmentsToday,
    expectedTodayCents,
    pendingPaymentsCount: pendingPaymentsCount ?? 0,
  };
}

function NextAppointmentCard({
  nextAppointment,
  timezone,
}: {
  nextAppointment: DashboardSummary['nextAppointment'];
  timezone: string;
}) {
  if (!nextAppointment) {
    return (
      <Card className="nx-next-card">
        <div className="nx-next-card-body">
          <p className="text-eyebrow">Próxima cliente</p>
          <p className="text-support">Nenhuma marcação.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="nx-next-card">
      <div className="nx-avatar" aria-hidden="true">
        {initials(nextAppointment.clientName)}
      </div>
      <div className="nx-next-card-body">
        <p className="text-eyebrow">Próxima cliente</p>
        <p className="nx-next-card-time">
          {formatInTimeZone(nextAppointment.startAtMs, timezone, 'HH:mm')}
        </p>
        <p className="text-support">
          {nextAppointment.clientName}
          {nextAppointment.itemDescriptions.length > 0
            ? ` · ${nextAppointment.itemDescriptions.join(', ')}`
            : ''}
        </p>
      </div>
      <Link
        href={`/dashboard/agenda/${nextAppointment.id}`}
        className="button"
        style={{ flexShrink: 0 }}
      >
        Ver marcação
      </Link>
    </Card>
  );
}

// NEX-080: "Próxima cliente aparece em destaque. Cartões mostram atendimentos por
// hora." (docs/02_UX_FLOWS.md, Fluxo C). requireProfile() (dashboard layout) already
// gates this page to an authenticated, provisioned owner and derives tenantId from
// their session — every query in loadDashboardData filters by it, and createClient()
// (cookie-scoped, RLS-enforced) is the same client every other authenticated dashboard
// page already uses, so there is no new authorization surface here.
export default async function DashboardPage() {
  const { tenantId } = await requireProfile();
  const { summary, timezone, appointmentsToday, expectedTodayCents, pendingPaymentsCount } =
    await loadDashboardData(tenantId);
  const previewItems = appointmentsToday.slice(0, 4);

  return (
    <div className="shell">
      <header className="nx-page-header">
        <div>
          <p className="text-eyebrow">Hoje</p>
          <h1 className="text-title">Olá! Vamos organizar o seu dia.</h1>
        </div>
        <Link
          href="/dashboard/lembretes"
          className={`nx-icon-button${summary.pendingRemindersCount > 0 ? ' nx-icon-button-dot' : ''}`}
          aria-label={`Lembretes (${summary.pendingRemindersCount} pendentes)`}
        >
          <Bell aria-hidden="true" />
        </Link>
      </header>

      <NextAppointmentCard nextAppointment={summary.nextAppointment} timezone={timezone} />

      <section
        className="nx-metrics-grid"
        aria-label="Resumo do dia"
        style={{ marginTop: '0.75rem' }}
      >
        <Card className="nx-metric-card">
          <span className="nx-metric-icon nx-metric-icon-primary" aria-hidden="true">
            <Calendar />
          </span>
          <p className="text-eyebrow">Marcações</p>
          <p className="text-numeral">{summary.todayCount} hoje</p>
        </Card>
        <Card className="nx-metric-card">
          <span className="nx-metric-icon nx-metric-icon-success" aria-hidden="true">
            <Wallet />
          </span>
          <p className="text-eyebrow">Total previsto</p>
          <p className="text-numeral">{formatEuros(expectedTodayCents)}</p>
        </Card>
        <Card className="nx-metric-card">
          <span className="nx-metric-icon nx-metric-icon-warning" aria-hidden="true">
            <Bell />
          </span>
          <p className="text-eyebrow">Lembretes</p>
          <p className="text-numeral">{summary.pendingRemindersCount} pendentes</p>
        </Card>
        <Card className="nx-metric-card">
          <span className="nx-metric-icon nx-metric-icon-info" aria-hidden="true">
            <CreditCard />
          </span>
          <p className="text-eyebrow">Pagamentos</p>
          <p className="text-numeral">{pendingPaymentsCount} pendentes</p>
        </Card>
      </section>

      <div className="nx-section-header">
        <p className="text-subtitle">Agenda do dia</p>
        <Link href="/dashboard/agenda" className="nx-section-link">
          Ver agenda
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>

      {previewItems.length === 0 ? (
        <Card>
          <p className="text-support">Sem marcações hoje.</p>
        </Card>
      ) : (
        <ul className="nx-preview-list">
          {previewItems.map((appointment) => (
            <li key={appointment.id} className="card nx-preview-item">
              <span className="nx-preview-item-time">
                {formatInTimeZone(appointment.startAtMs, timezone, 'HH:mm')}
              </span>
              <span className="nx-preview-item-body">
                <p className="nx-preview-item-name">{appointment.clientName}</p>
                {appointment.itemDescriptions.length > 0 ? (
                  <p className="nx-preview-item-service">
                    {appointment.itemDescriptions.join(', ')}
                  </p>
                ) : null}
              </span>
              <span
                className={`nx-status-dot nx-status-dot-${appointment.status}`}
                aria-label={appointment.status}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
