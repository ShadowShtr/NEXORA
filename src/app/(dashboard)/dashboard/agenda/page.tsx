import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { AppointmentCard, type AppointmentCardData } from '@/features/appointments/AppointmentCard';
import type { AppointmentCardStatus } from '@/features/appointments/domain/appointment-card';
import {
  formatRangeLabel,
  resolveCalendarRange,
  shiftCalendarDate,
  type CalendarView,
} from '@/features/appointments/domain/calendar-navigation';

function capitalize(label: string): string {
  return label.length === 0 ? label : label[0]!.toUpperCase() + label.slice(1);
}

function isCalendarView(value: string | undefined): value is CalendarView {
  return value === 'day' || value === 'week' || value === 'month';
}

// Data loading (including the Date.now() read) lives outside the component body — see
// the same purity-rule note in src/app/(dashboard)/dashboard/page.tsx (NEX-080).
async function loadAgendaData(
  tenantId: string,
  view: CalendarView,
  requestedDateKey: string | undefined,
) {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from('business_settings')
    .select('timezone')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const timezone = settings?.timezone ?? 'Europe/Lisbon';

  const todayKey = formatInTimeZone(Date.now(), timezone, 'yyyy-MM-dd');
  const dateKey = requestedDateKey ?? todayKey;
  const range = resolveCalendarRange(view, dateKey, timezone);

  const { data: rows } = await supabase
    .from('appointments')
    .select(
      'id, start_at, status, expected_total_cents, final_total_cents, clients(name, phone_e164), appointment_items(description)',
    )
    .eq('tenant_id', tenantId)
    .gte('start_at', range.startIso)
    .lt('start_at', range.endIso)
    .order('start_at');

  const byDateKey = new Map<string, AppointmentCardData[]>();
  for (const key of range.dateKeys) byDateKey.set(key, []);

  for (const row of rows ?? []) {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const card: AppointmentCardData = {
      id: row.id,
      timeLabel: formatInTimeZone(row.start_at, timezone, 'HH:mm'),
      clientName: client?.name ?? 'Cliente',
      clientPhoneE164: client?.phone_e164 ?? null,
      itemDescriptions: (row.appointment_items ?? []).map((item) => item.description),
      totalCents: row.final_total_cents ?? row.expected_total_cents,
      status: row.status as AppointmentCardStatus,
    };
    const dateKeyForRow = formatInTimeZone(row.start_at, timezone, 'yyyy-MM-dd');
    const list = byDateKey.get(dateKeyForRow);
    if (list) list.push(card);
  }

  return { timezone, dateKey, todayKey, range, byDateKey };
}

function navHref(view: CalendarView, dateKey: string) {
  return `/dashboard/agenda?view=${view}&date=${dateKey}`;
}

// NEX-082: "Navegação eficiente e responsiva" across day/week/month (docs/02_UX_FLOWS.md,
// Fluxo C, and NEX-081's "atendimentos por hora"). requireProfile() (dashboard layout)
// gates this page to an authenticated, provisioned owner and derives tenantId from
// their session — every query filters by it, same pattern as every other authenticated
// dashboard page. View/date state lives in the URL (?view=&date=), not client
// component state — a server-rendered page with plain links, so back/forward and
// bookmarking a specific week/month both work for free.
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const { tenantId } = await requireProfile();
  const params = await searchParams;
  const view: CalendarView = isCalendarView(params.view) ? params.view : 'day';

  const { timezone, dateKey, todayKey, range, byDateKey } = await loadAgendaData(
    tenantId,
    view,
    params.date,
  );

  const previousDateKey = shiftCalendarDate(view, dateKey, -1);
  const nextDateKey = shiftCalendarDate(view, dateKey, 1);
  const rangeLabel = formatRangeLabel(view, range.dateKeys, timezone);
  const totalAppointments = Array.from(byDateKey.values()).reduce(
    (sum, list) => sum + list.length,
    0,
  );

  return (
    <div className="shell">
      <p className="eyebrow">Agenda</p>
      <h1>Agenda</h1>

      <nav className="agenda-view-switcher" aria-label="Vista da agenda">
        <a
          href={navHref('day', dateKey)}
          aria-current={view === 'day' ? 'page' : undefined}
          className="button-secondary button"
        >
          Dia
        </a>
        <a
          href={navHref('week', dateKey)}
          aria-current={view === 'week' ? 'page' : undefined}
          className="button-secondary button"
        >
          Semana
        </a>
        <a
          href={navHref('month', dateKey)}
          aria-current={view === 'month' ? 'page' : undefined}
          className="button-secondary button"
        >
          Mês
        </a>
      </nav>

      <nav className="agenda-date-nav" aria-label="Navegar datas">
        <a href={navHref(view, previousDateKey)} className="button-secondary button">
          Anterior
        </a>
        <span className="agenda-range-label">{capitalize(rangeLabel)}</span>
        <a href={navHref(view, nextDateKey)} className="button-secondary button">
          Seguinte
        </a>
        {dateKey !== todayKey ? (
          <a href={navHref(view, todayKey)} className="button-secondary button">
            Hoje
          </a>
        ) : null}
      </nav>

      {totalAppointments === 0 ? (
        <Card>
          <p>Sem marcações neste período.</p>
        </Card>
      ) : (
        <div className="agenda-day-groups">
          {range.dateKeys.map((key) => {
            const appointments = byDateKey.get(key) ?? [];
            if (appointments.length === 0 && view !== 'day') return null;
            return (
              <section key={key} aria-label={key}>
                {view !== 'day' ? (
                  <p className="agenda-day-group-label">
                    {capitalize(
                      formatInTimeZone(
                        fromZonedTime(`${key}T12:00:00`, timezone),
                        timezone,
                        "EEEE, dd 'de' MMMM",
                        { locale: pt },
                      ),
                    )}
                  </p>
                ) : null}
                {appointments.length === 0 ? (
                  <p className="appointment-card-items">Sem marcações.</p>
                ) : (
                  <ul className="appointment-card-list">
                    {appointments.map((appointment) => (
                      <AppointmentCard key={appointment.id} appointment={appointment} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
