import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { computeAvailableSlotsMs } from '@/lib/availability-lookup';
import { listResources, listTeamMembers } from '@/features/team/queries';
import { AppointmentCard, type AppointmentCardData } from '@/features/appointments/AppointmentCard';
import { AgendaCompletionProvider } from '@/features/appointments/AgendaCompletionContext';
import { AgendaDatePicker } from '@/features/appointments/AgendaDatePicker';
import { AgendaFab } from '@/features/appointments/AgendaFab';
import type { AppointmentCardStatus } from '@/features/appointments/domain/appointment-card';
import {
  formatRangeLabel,
  resolveCalendarRange,
  shiftCalendarDate,
  type CalendarView,
} from '@/features/appointments/domain/calendar-navigation';
import {
  filterFreeSlotsInRange,
  groupFreeSlotsByDay,
  type FreeSlotsByDay,
} from '@/features/appointments/domain/free-slots-summary';

function capitalize(label: string): string {
  return label.length === 0 ? label : label[0]!.toUpperCase() + label.slice(1);
}

function isCalendarView(value: string | undefined): value is CalendarView {
  return value === 'day' || value === 'week' || value === 'month';
}

type AgendaFilter =
  | { kind: 'all' }
  | { kind: 'me'; providerId: string }
  | { kind: 'provider'; providerId: string }
  | { kind: 'resource'; resourceId: string };

// Data loading (including the Date.now() read) lives outside the component body — see
// the same purity-rule note in src/app/(dashboard)/dashboard/page.tsx (NEX-080).
async function loadAgendaData(
  tenantId: string,
  view: CalendarView,
  requestedDateKey: string | undefined,
  filter: AgendaFilter,
) {
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from('business_settings')
    .select(
      'timezone, slot_interval_minutes, buffer_minutes, min_notice_hours, booking_window_days',
    )
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const timezone = settings?.timezone ?? 'Europe/Lisbon';

  const nowMs = Date.now();
  const todayKey = formatInTimeZone(nowMs, timezone, 'yyyy-MM-dd');
  const dateKey = requestedDateKey ?? todayKey;
  const range = resolveCalendarRange(view, dateKey, timezone);

  let appointmentsQuery = supabase
    .from('appointments')
    .select(
      'id, start_at, status, expected_total_cents, final_total_cents, provider_id, resource_id, clients(name, phone_e164), appointment_items(description)',
    )
    .eq('tenant_id', tenantId)
    .gte('start_at', range.startIso)
    .lt('start_at', range.endIso)
    .order('start_at');
  if (filter.kind === 'me' || filter.kind === 'provider') {
    appointmentsQuery = appointmentsQuery.eq('provider_id', filter.providerId);
  } else if (filter.kind === 'resource') {
    appointmentsQuery = appointmentsQuery.eq('resource_id', filter.resourceId);
  }

  const [{ data: rows }, { data: shortestServiceRows }, { data: activeServiceRows }, members] =
    await Promise.all([
      appointmentsQuery,
      supabase
        .from('services')
        .select('duration_minutes')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('duration_minutes')
        .limit(1),
      supabase
        .from('services')
        .select('id, name, price_cents')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('name'),
      listTeamMembers(tenantId),
    ]);

  const providerColorByProviderId = new Map(
    members.filter((m) => m.providerId).map((m) => [m.providerId as string, m.providerColor]),
  );

  const availableServices = (activeServiceRows ?? []).map((service) => ({
    id: service.id,
    name: service.name,
    priceCents: service.price_cents,
  }));

  const byDateKey = new Map<string, AppointmentCardData[]>();
  for (const key of range.dateKeys) byDateKey.set(key, []);

  for (const row of rows ?? []) {
    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const card: AppointmentCardData = {
      id: row.id,
      timeLabel: formatInTimeZone(row.start_at, timezone, 'HH:mm'),
      startAtMs: new Date(row.start_at).getTime(),
      clientName: client?.name ?? 'Cliente',
      clientPhoneE164: client?.phone_e164 ?? null,
      itemDescriptions: (row.appointment_items ?? []).map((item) => item.description),
      totalCents: row.final_total_cents ?? row.expected_total_cents,
      status: row.status as AppointmentCardStatus,
      providerColor: row.provider_id
        ? (providerColorByProviderId.get(row.provider_id) ?? null)
        : null,
    };
    const dateKeyForRow = formatInTimeZone(row.start_at, timezone, 'yyyy-MM-dd');
    const list = byDateKey.get(dateKeyForRow);
    if (list) list.push(card);
  }

  // NEX-083: "Resumo/lista de horários livres", consistent with the availability
  // engine (NEX-061/062) — the shortest active service is the smallest real
  // commitment a slot could ever be booked for; falls back to the configured slot
  // step when the catalog has no active service yet.
  let freeSlotsByDay: FreeSlotsByDay[] = [];
  if (settings) {
    const referenceDurationMinutes =
      shortestServiceRows?.[0]?.duration_minutes ?? settings.slot_interval_minutes;
    const slotsMs = await computeAvailableSlotsMs(
      supabase,
      tenantId,
      {
        timezone: settings.timezone,
        slotIntervalMinutes: settings.slot_interval_minutes as 15 | 30 | 60,
        bufferMinutes: settings.buffer_minutes,
        minNoticeHours: settings.min_notice_hours,
        bookingWindowDays: settings.booking_window_days,
      },
      referenceDurationMinutes,
    );
    freeSlotsByDay = filterFreeSlotsInRange(groupFreeSlotsByDay(slotsMs, timezone), range.dateKeys);
  }

  return {
    timezone,
    dateKey,
    todayKey,
    range,
    byDateKey,
    freeSlotsByDay,
    availableServices,
    nowMs,
    members,
  };
}

function navHref(
  view: CalendarView,
  dateKey: string,
  filterKind?: string | null,
  filterId?: string | null,
) {
  const base = `/dashboard/agenda?view=${view}&date=${dateKey}`;
  return filterKind && filterId ? `${base}&filterKind=${filterKind}&filterId=${filterId}` : base;
}

function isAgendaFilterKind(value: string | undefined): value is 'me' | 'provider' | 'resource' {
  return value === 'me' || value === 'provider' || value === 'resource';
}

// NEX-082: "Navegação eficiente e responsiva" across day/week/month (docs/02_UX_FLOWS.md,
// Fluxo C, and NEX-081's "atendimentos por hora"). requireProfile() (dashboard layout)
// gates this page to an authenticated, provisioned owner and derives tenantId from
// their session — every query filters by it, same pattern as every other authenticated
// dashboard page. View/date state lives in the URL (?view=&date=), not client
// component state — a server-rendered page with plain links, so back/forward and
// bookmarking a specific week/month both work for free.
//
// NEX-218: filtros Todos/Eu/prestador/Recursos e cor do prestador (faixa lateral de
// 4px, AppointmentCard.tsx) somam-se à navegação existente, sem a substituir — filtro
// e vista/data persistem juntos na própria URL.
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; filterKind?: string; filterId?: string }>;
}) {
  const { tenantId, userId } = await requireProfile();
  const params = await searchParams;
  const view: CalendarView = isCalendarView(params.view) ? params.view : 'day';

  const filterKind = isAgendaFilterKind(params.filterKind) ? params.filterKind : null;
  const filterId = params.filterId ?? null;
  const filter: AgendaFilter =
    filterKind && filterId
      ? filterKind === 'resource'
        ? { kind: 'resource', resourceId: filterId }
        : { kind: filterKind, providerId: filterId }
      : { kind: 'all' };

  const [
    {
      timezone,
      dateKey,
      todayKey,
      range,
      byDateKey,
      freeSlotsByDay,
      availableServices,
      nowMs,
      members,
    },
    resources,
  ] = await Promise.all([
    loadAgendaData(tenantId, view, params.date, filter),
    listResources(tenantId),
  ]);

  const ownProvider = members.find((m) => m.userId === userId && m.providerId);
  const providerChips = members.filter((m) => m.isProvider && m.providerId);

  const previousDateKey = shiftCalendarDate(view, dateKey, -1);
  const nextDateKey = shiftCalendarDate(view, dateKey, 1);
  const rangeLabel = formatRangeLabel(view, range.dateKeys, timezone);
  const totalAppointments = Array.from(byDateKey.values()).reduce(
    (sum, list) => sum + list.length,
    0,
  );
  const totalFreeSlots = freeSlotsByDay.reduce((sum, day) => sum + day.count, 0);

  return (
    <div className="shell agenda-page">
      <h1 className="text-title agenda-title">Agenda</h1>

      <div className="agenda-date-row">
        <AgendaDatePicker view={view} dateKey={dateKey} label={capitalize(rangeLabel)} />
        <nav className="agenda-date-nav" aria-label="Navegar datas">
          <a
            href={navHref(view, previousDateKey, filterKind, filterId)}
            className="nx-icon-button agenda-nav-icon-button"
            aria-label="Data anterior"
          >
            <ChevronLeft aria-hidden="true" />
          </a>
          {dateKey !== todayKey ? (
            <a href={navHref(view, todayKey, filterKind, filterId)} className="agenda-today-link">
              Hoje
            </a>
          ) : null}
          <a
            href={navHref(view, nextDateKey, filterKind, filterId)}
            className="nx-icon-button agenda-nav-icon-button"
            aria-label="Data seguinte"
          >
            <ChevronRight aria-hidden="true" />
          </a>
        </nav>
      </div>

      <div
        role="tablist"
        aria-label="Vista da agenda"
        className="nx-tabs nx-tabs-pill agenda-view-tabs"
      >
        <a
          href={navHref('day', dateKey, filterKind, filterId)}
          role="tab"
          aria-current={view === 'day' ? 'page' : undefined}
          className="nx-tab"
        >
          Dia
        </a>
        <a
          href={navHref('week', dateKey, filterKind, filterId)}
          role="tab"
          aria-current={view === 'week' ? 'page' : undefined}
          className="nx-tab"
        >
          Semana
        </a>
        <a
          href={navHref('month', dateKey, filterKind, filterId)}
          role="tab"
          aria-current={view === 'month' ? 'page' : undefined}
          className="nx-tab"
        >
          Lista
        </a>
      </div>

      {providerChips.length > 0 || resources.length > 0 ? (
        <div
          className="clients-filter-chips agenda-provider-filters"
          aria-label="Filtrar por prestador ou recurso"
        >
          <a
            href={navHref(view, dateKey)}
            className="filter-chip"
            data-active={filter.kind === 'all' || undefined}
          >
            Todos
          </a>
          {ownProvider?.providerId ? (
            <a
              href={navHref(view, dateKey, 'me', ownProvider.providerId)}
              className="filter-chip"
              data-active={filter.kind === 'me' || undefined}
            >
              Eu
            </a>
          ) : null}
          {providerChips.map((provider) => (
            <a
              key={provider.providerId}
              href={navHref(view, dateKey, 'provider', provider.providerId as string)}
              className="filter-chip"
              data-active={
                (filter.kind === 'provider' && filter.providerId === provider.providerId) ||
                undefined
              }
            >
              {provider.displayName}
            </a>
          ))}
          {resources.map((resource) => (
            <a
              key={resource.id}
              href={navHref(view, dateKey, 'resource', resource.id)}
              className="filter-chip"
              data-active={
                (filter.kind === 'resource' && filter.resourceId === resource.id) || undefined
              }
            >
              {resource.name}
            </a>
          ))}
        </div>
      ) : null}

      <Card className="agenda-free-slots">
        <details>
          <summary className="agenda-free-slots-summary">
            {totalFreeSlots === 0
              ? 'Agenda completa neste período'
              : `${totalFreeSlots} ${totalFreeSlots === 1 ? 'horário livre' : 'horários livres'} neste período`}
          </summary>
          {totalFreeSlots === 0 ? null : (
            <ul className="agenda-free-slots-list">
              {freeSlotsByDay.map((day) => (
                <li key={day.dateKey}>
                  <span className="agenda-free-slots-day-label">
                    {capitalize(
                      formatInTimeZone(
                        fromZonedTime(`${day.dateKey}T12:00:00`, timezone),
                        timezone,
                        'EEEE dd/MM',
                        { locale: pt },
                      ),
                    )}
                  </span>
                  <span className="agenda-free-slots-day-count">
                    {day.count} {day.count === 1 ? 'horário' : 'horários'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </details>
      </Card>

      {totalAppointments === 0 ? (
        <Card>
          <p className="text-support">Sem marcações neste período.</p>
        </Card>
      ) : (
        <AgendaCompletionProvider availableServices={availableServices}>
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
                      {view === 'month' && appointments.length > 0 ? (
                        <span
                          className="agenda-day-group-count"
                          aria-label={`${appointments.length} marcações`}
                        >
                          {appointments.length}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                  {appointments.length === 0 ? (
                    <p className="appointment-card-items">Sem marcações.</p>
                  ) : (
                    <ul className="appointment-card-list">
                      {appointments.map((appointment) => (
                        <AppointmentCard
                          key={appointment.id}
                          appointment={appointment}
                          nowMs={nowMs}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
            <div id="agenda-list-end" aria-hidden="true" />
          </div>
        </AgendaCompletionProvider>
      )}

      <AgendaFab />
    </div>
  );
}
