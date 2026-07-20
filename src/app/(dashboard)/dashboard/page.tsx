import Link from 'next/link';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import { Bell, CalendarPlus, Share2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { initials } from '@/lib/initials';
import { publicBookingUrl } from '@/features/onboarding/domain/publish-step';
import {
  buildDashboardSummary,
  type AppointmentSummary,
  type DashboardSummary,
} from '@/features/dashboard/domain/summary';

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function capitalize(label: string): string {
  return label.length === 0 ? label : label[0]!.toUpperCase() + label.slice(1);
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? displayName;
}

// Rounded to whole minutes/hours — a countdown accurate to the second would be
// misleading anyway, since this is computed once per page load, not live-ticking.
function minutesUntilLabel(startAtMs: number, nowMs: number): string {
  const minutes = Math.round((startAtMs - nowMs) / 60_000);
  if (minutes <= 0) return 'Agora';
  if (minutes < 60) return `Em ${minutes} min`;
  return `Em ${Math.round(minutes / 60)} h`;
}

function dueDateLabel(dueAtMs: number, nowMs: number, timezone: string): string {
  const dueKey = formatInTimeZone(dueAtMs, timezone, 'yyyy-MM-dd');
  const todayKey = formatInTimeZone(nowMs, timezone, 'yyyy-MM-dd');
  const tomorrowKey = formatInTimeZone(nowMs + 24 * 60 * 60_000, timezone, 'yyyy-MM-dd');
  if (dueKey === todayKey) return 'Hoje';
  if (dueKey === tomorrowKey) return 'Amanhã';
  return formatInTimeZone(dueAtMs, timezone, 'dd MMM', { locale: pt });
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
    { data: profileRow },
    { data: tenantRow },
    { data: appointmentRows },
    { count: pendingRemindersCount },
    { data: paymentRows },
    { data: upcomingReminderRows },
  ] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('tenants').select('slug').eq('id', tenantId).single(),
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
      .from('reminders')
      .select('id, due_at, appointments(start_at, clients(name))')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('due_at')
      .limit(3),
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
      totalCents: row.final_total_cents ?? row.expected_total_cents,
    };
  });

  const todayApptIds = appointmentsToday.map((appointment) => appointment.id);
  const { data: pendingPaymentRows } =
    todayApptIds.length > 0
      ? await supabase
          .from('payments')
          .select('amount_cents')
          .eq('tenant_id', tenantId)
          .eq('status', 'pending')
          .in('appointment_id', todayApptIds)
      : { data: [] };

  const receivedTodayCents = (paymentRows ?? []).reduce((sum, row) => sum + row.amount_cents, 0);
  const pendingTodayCents = (pendingPaymentRows ?? []).reduce(
    (sum, row) => sum + row.amount_cents,
    0,
  );

  const summary = buildDashboardSummary(
    appointmentsToday,
    pendingRemindersCount ?? 0,
    receivedTodayCents,
    pendingTodayCents,
    nowMs,
  );

  const upcomingReminders = (upcomingReminderRows ?? []).map((row) => {
    const appointment = Array.isArray(row.appointments) ? row.appointments[0] : row.appointments;
    const client = appointment
      ? Array.isArray(appointment.clients)
        ? appointment.clients[0]
        : appointment.clients
      : null;
    return {
      id: row.id,
      clientName: client?.name ?? 'Cliente',
      dueAtMs: new Date(row.due_at).getTime(),
    };
  });

  return {
    summary,
    timezone,
    nowMs,
    ownerName: profileRow?.display_name ?? '',
    tenantSlug: tenantRow?.slug ?? '',
    upcomingReminders,
  };
}

function NextClientCard({
  nextAppointment,
  timezone,
  nowMs,
}: {
  nextAppointment: DashboardSummary['nextAppointment'];
  timezone: string;
  nowMs: number;
}) {
  if (!nextAppointment) {
    return (
      <Card>
        <p className="text-eyebrow">Próxima cliente</p>
        <p className="text-support">Sem marcações agendadas.</p>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-eyebrow">Próxima cliente</p>
      <div className="dashboard-next-client-row">
        <span className="dashboard-avatar" aria-hidden="true">
          {initials(nextAppointment.clientName)}
        </span>
        <span className="dashboard-next-client-info">
          <span className="dashboard-next-client-name">{nextAppointment.clientName}</span>
          <span className="text-support">
            {formatInTimeZone(nextAppointment.startAtMs, timezone, 'HH:mm')}
            {nextAppointment.itemDescriptions.length > 0
              ? ` · ${nextAppointment.itemDescriptions.join(', ')}`
              : ''}
          </span>
        </span>
        <span className="dashboard-next-client-badge">
          {minutesUntilLabel(nextAppointment.startAtMs, nowMs)}
        </span>
      </div>
      <Link
        href={`/dashboard/agenda/${nextAppointment.id}`}
        className="button button-secondary link-button dashboard-next-client-cta"
      >
        Ver detalhes
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
//
// Visual refinement mid-2026: reference's "Lembretes" section showed stock/birthday/
// training examples with no real data source in this schema (no inventory table, no
// client birthday field, no CPD/training tracking) — shown here instead with the one
// real reminder concept this schema has, appointment reminders (NEX-101). Same
// reasoning trimmed "Atalhos rápidos" to the two shortcuts that lead somewhere real
// today (nova marcação, link da página) instead of the reference's four — "novo
// cliente" and "venda rápida" have no dedicated flow yet.
export default async function DashboardPage() {
  const { tenantId } = await requireProfile();
  const { summary, timezone, nowMs, ownerName, tenantSlug, upcomingReminders } =
    await loadDashboardData(tenantId);
  const publicUrl = tenantSlug ? publicBookingUrl(publicEnv.NEXT_PUBLIC_APP_URL, tenantSlug) : null;

  return (
    <div className="shell">
      <header className="dashboard-greeting">
        <div className="dashboard-greeting-row">
          <h1 className="text-title">Olá{ownerName ? `, ${firstName(ownerName)}` : ''}! 👋</h1>
          <Link
            href="/dashboard/lembretes"
            className="dashboard-bell"
            aria-label={
              summary.pendingRemindersCount > 0
                ? `Lembretes (${summary.pendingRemindersCount} pendentes)`
                : 'Lembretes'
            }
          >
            <Bell aria-hidden="true" size={20} />
            {summary.pendingRemindersCount > 0 ? (
              <span className="dashboard-bell-badge" aria-hidden="true" />
            ) : null}
          </Link>
        </div>
        <p className="text-support">
          {capitalize(formatInTimeZone(nowMs, timezone, "EEEE, dd 'de' MMMM", { locale: pt }))}
        </p>
      </header>

      <NextClientCard nextAppointment={summary.nextAppointment} timezone={timezone} nowMs={nowMs} />

      <p className="text-eyebrow dashboard-section-title">Resumo do dia</p>
      <div className="dashboard-stats-row">
        <div className="card dashboard-stat-card">
          <span className="text-numeral">{summary.todayCount}</span>
          <span className="text-meta">Marcações</span>
        </div>
        <div className="card dashboard-stat-card">
          <span className="text-numeral">{formatEuros(summary.invoicedTodayCents)}</span>
          <span className="text-meta">Faturado</span>
        </div>
        <div className="card dashboard-stat-card">
          <span className="text-numeral">{formatEuros(summary.pendingTodayCents)}</span>
          <span className="text-meta">Pendente</span>
        </div>
      </div>

      {upcomingReminders.length > 0 ? (
        <>
          <p className="text-eyebrow dashboard-section-title">Lembretes</p>
          <div className="card dashboard-reminders">
            <ul>
              {upcomingReminders.map((reminder) => (
                <li key={reminder.id} className="dashboard-reminder-row">
                  <span className="dashboard-reminder-icon" aria-hidden="true">
                    <Bell size={16} />
                  </span>
                  <span className="dashboard-reminder-text">
                    Enviar lembrete a {reminder.clientName}
                  </span>
                  <span className="dashboard-reminder-badge">
                    {dueDateLabel(reminder.dueAtMs, nowMs, timezone)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      <p className="text-eyebrow dashboard-section-title">Atalhos rápidos</p>
      <div className="dashboard-shortcuts">
        <Link href="/dashboard/agenda/nova" className="dashboard-shortcut">
          <CalendarPlus aria-hidden="true" size={20} />
          Nova marcação
        </Link>
        {publicUrl ? (
          <a href={publicUrl} target="_blank" rel="noreferrer" className="dashboard-shortcut">
            <Share2 aria-hidden="true" size={20} />
            Link da página
          </a>
        ) : null}
      </div>
    </div>
  );
}
