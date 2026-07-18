import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { AppointmentCard, type AppointmentCardData } from '@/features/appointments/AppointmentCard';
import type { AppointmentCardStatus } from '@/features/appointments/domain/appointment-card';

// Data loading (including the Date.now() read) lives outside the component body — see
// the same purity-rule note in src/app/(dashboard)/dashboard/page.tsx (NEX-080).
async function loadTodayAppointments(tenantId: string): Promise<{
  appointments: AppointmentCardData[];
  timezone: string;
}> {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from('business_settings')
    .select('timezone')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const timezone = settings?.timezone ?? 'Europe/Lisbon';

  const nowMs = Date.now();
  const todayKey = formatInTimeZone(nowMs, timezone, 'yyyy-MM-dd');
  const dayStart = fromZonedTime(`${todayKey}T00:00:00`, timezone);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);

  const { data: rows } = await supabase
    .from('appointments')
    .select(
      'id, start_at, status, expected_total_cents, final_total_cents, clients(name, phone_e164), appointment_items(description)',
    )
    .eq('tenant_id', tenantId)
    .gte('start_at', dayStart.toISOString())
    .lt('start_at', dayEnd.toISOString())
    .order('start_at');

  const appointments: AppointmentCardData[] = (rows ?? []).map((row) => {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    return {
      id: row.id,
      timeLabel: formatInTimeZone(row.start_at, timezone, 'HH:mm'),
      clientName: client?.name ?? 'Cliente',
      clientPhoneE164: client?.phone_e164 ?? null,
      itemDescriptions: (row.appointment_items ?? []).map((item) => item.description),
      totalCents: row.final_total_cents ?? row.expected_total_cents,
      status: row.status as AppointmentCardStatus,
    };
  });

  return { appointments, timezone };
}

// NEX-081: "Cartões mostram atendimentos por hora" (docs/02_UX_FLOWS.md, Fluxo C).
// requireProfile() (dashboard layout) gates this page to an authenticated, provisioned
// owner and derives tenantId from their session — every query filters by it, same
// pattern as every other authenticated dashboard page (servicos/page.tsx,
// dashboard/page.tsx).
export default async function AgendaPage() {
  const { tenantId } = await requireProfile();
  const { appointments } = await loadTodayAppointments(tenantId);

  return (
    <div className="shell">
      <p className="eyebrow">Agenda</p>
      <h1>Agenda</h1>
      {appointments.length === 0 ? (
        <Card>
          <p>Sem marcações para hoje.</p>
        </Card>
      ) : (
        <ul className="appointment-card-list">
          {appointments.map((appointment) => (
            <AppointmentCard key={appointment.id} appointment={appointment} />
          ))}
        </ul>
      )}
    </div>
  );
}
