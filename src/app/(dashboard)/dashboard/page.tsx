import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
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

  const [{ data: appointmentRows }, { count: pendingRemindersCount }, { data: paymentRows }] =
    await Promise.all([
      supabase
        .from('appointments')
        .select('id, start_at, end_at, status, clients(name), appointment_items(description)')
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

  const receivedTodayCents = (paymentRows ?? []).reduce((sum, row) => sum + row.amount_cents, 0);

  const summary = buildDashboardSummary(
    appointmentsToday,
    pendingRemindersCount ?? 0,
    receivedTodayCents,
    nowMs,
  );

  return { summary, timezone };
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
      <Card>
        <p className="text-eyebrow">Próxima cliente</p>
        <p className="text-support">Nenhuma marcação.</p>
      </Card>
    );
  }

  return (
    <Card>
      <p className="text-eyebrow">Próxima cliente</p>
      <p className="text-support">
        {formatInTimeZone(nextAppointment.startAtMs, timezone, 'HH:mm')} ·{' '}
        {nextAppointment.clientName}
        {nextAppointment.itemDescriptions.length > 0
          ? ` — ${nextAppointment.itemDescriptions.join(', ')}`
          : ''}
      </p>
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
  const { summary, timezone } = await loadDashboardData(tenantId);

  return (
    <div className="shell">
      <p className="text-eyebrow">Hoje</p>
      <h1 className="text-title">Olá! Vamos organizar o seu dia.</h1>
      <section className="dashboard-grid" aria-label="Resumo do dia">
        <NextAppointmentCard nextAppointment={summary.nextAppointment} timezone={timezone} />
        <Card>
          <p className="text-eyebrow">Marcações</p>
          <p className="text-numeral">{summary.todayCount} hoje</p>
        </Card>
        <Card>
          <p className="text-eyebrow">Lembretes</p>
          <p className="text-numeral">{summary.pendingRemindersCount} pendentes</p>
        </Card>
        <Card>
          <p className="text-eyebrow">Recebido</p>
          <p className="text-numeral">{formatEuros(summary.receivedTodayCents)}</p>
        </Card>
      </section>
    </div>
  );
}
