import Link from 'next/link';
import { formatInTimeZone } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import { CheckCircle2, ChevronLeft } from 'lucide-react';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { logEvent } from '@/lib/logger';
import { getRequestId } from '@/lib/request-id';
import { buildWhatsappDeepLink } from '@/features/appointments/domain/appointment-card';
import {
  resolveReminderBadge,
  type ReminderBadge,
} from '@/features/reminders/domain/reminder-badges';
import {
  groupReminders,
  type GroupableReminder,
  type ReminderGroup,
} from '@/features/reminders/domain/reminder-groups';
import { ReminderCard, type ReminderCardData } from '@/features/reminders/ReminderCard';
import {
  DEFAULT_REMINDER_TEMPLATE,
  renderReminderTemplate,
} from '@/features/reminders/domain/template';

// A rolling cap, not pagination — grouping by urgency needs the full working set in one
// pass, and 200 non-skipped reminders is far beyond what a solo professional's daily
// action list ever needs to reach back to. Ordered by due_at descending so a tenant
// past this cap still sees its most recent 200, not its oldest.
const REMINDER_FETCH_LIMIT = 200;

type FilterKey = 'all' | 'late' | 'today' | 'opened' | 'sent';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'late', label: 'Atrasados' },
  { key: 'today', label: 'Hoje' },
  { key: 'opened', label: 'WhatsApp aberto' },
  { key: 'sent', label: 'Enviados' },
];

function isFilterKey(value: string | undefined): value is FilterKey {
  return (
    value === 'all' ||
    value === 'late' ||
    value === 'today' ||
    value === 'opened' ||
    value === 'sent'
  );
}

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function dateTimeLabel(startAtMs: number, nowMs: number, timezone: string): string {
  const dateKey = formatInTimeZone(startAtMs, timezone, 'yyyy-MM-dd');
  const todayKey = formatInTimeZone(nowMs, timezone, 'yyyy-MM-dd');
  const tomorrowKey = formatInTimeZone(nowMs + 24 * 60 * 60_000, timezone, 'yyyy-MM-dd');
  const time = formatInTimeZone(startAtMs, timezone, 'HH:mm');
  if (dateKey === todayKey) return `Hoje, ${time}`;
  if (dateKey === tomorrowKey) return `Amanhã, ${time}`;
  return `${formatInTimeZone(startAtMs, timezone, 'dd MMM', { locale: pt })} · ${time}`;
}

function sentAtLabel(sentAtMs: number, nowMs: number, timezone: string): string {
  const dateKey = formatInTimeZone(sentAtMs, timezone, 'yyyy-MM-dd');
  const todayKey = formatInTimeZone(nowMs, timezone, 'yyyy-MM-dd');
  const time = formatInTimeZone(sentAtMs, timezone, 'HH:mm');
  if (dateKey === todayKey) return `Enviado hoje às ${time}`;
  return `Enviado ${formatInTimeZone(sentAtMs, timezone, 'dd/MM')} às ${time}`;
}

type ReminderRow = GroupableReminder & {
  id: string;
  card: ReminderCardData;
};

// NEX-101: "Pendentes, overdue e concluídos com badges" — requireProfile() (dashboard
// layout) gates this page to an authenticated, provisioned owner and derives tenantId
// from their session; every query filters by it (RLS via createClient() enforces this
// too, as defense in depth). Skipped reminders (a cancelled/no_show appointment,
// NEX-100) stay excluded — there is nothing left for the dona to act on for those.
async function loadReminders(tenantId: string) {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('business_settings')
    .select('timezone, reminder_message_template')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const timezone = settings?.timezone ?? 'Europe/Lisbon';
  const messageTemplate = settings?.reminder_message_template ?? DEFAULT_REMINDER_TEMPLATE;

  const nowMs = Date.now();
  const { data } = await supabase
    .from('reminders')
    .select(
      'id, due_at, status, marked_sent_at, appointments(id, start_at, expected_total_cents, final_total_cents, clients(name, phone_e164), appointment_items(description))',
    )
    .eq('tenant_id', tenantId)
    .neq('status', 'skipped')
    .order('due_at', { ascending: false })
    .limit(REMINDER_FETCH_LIMIT);

  const rows: ReminderRow[] = (data ?? []).map((row) => {
    const appointment = Array.isArray(row.appointments) ? row.appointments[0] : row.appointments;
    const client = appointment
      ? Array.isArray(appointment.clients)
        ? appointment.clients[0]
        : appointment.clients
      : null;
    const status = row.status as 'pending' | 'opened' | 'marked_sent';
    const dueAtMs = new Date(row.due_at).getTime();
    const badge: ReminderBadge = resolveReminderBadge(status, dueAtMs, nowMs);
    const appointmentStartAtMs = appointment ? new Date(appointment.start_at).getTime() : null;
    const sentAtMs = row.marked_sent_at ? new Date(row.marked_sent_at).getTime() : null;

    const itemDescriptions = (appointment?.appointment_items ?? []).map((item) => item.description);
    const totalCents = appointment
      ? (appointment.final_total_cents ?? appointment.expected_total_cents)
      : null;
    const serviceLabel =
      itemDescriptions.length > 0
        ? `${itemDescriptions.join(', ')}${totalCents !== null ? ` · ${formatEuros(totalCents)}` : ''}`
        : null;

    const whatsappHref =
      client?.phone_e164 && appointment
        ? buildWhatsappDeepLink(
            client.phone_e164,
            renderReminderTemplate(messageTemplate, {
              clientName: client.name ?? 'Cliente',
              dateLabel: formatInTimeZone(appointment.start_at, timezone, 'dd/MM', { locale: pt }),
              timeLabel: formatInTimeZone(appointment.start_at, timezone, 'HH:mm'),
            }),
          )
        : null;

    return {
      id: row.id,
      badge,
      appointmentStartAtMs,
      dueAtMs,
      sentAtMs,
      card: {
        reminderId: row.id,
        appointmentId: appointment?.id ?? null,
        clientName: client?.name ?? 'Cliente',
        dateTimeLabel: appointmentStartAtMs
          ? dateTimeLabel(appointmentStartAtMs, nowMs, timezone)
          : '—',
        serviceLabel,
        badge,
        whatsappHref,
        sentAtLabel: sentAtMs ? sentAtLabel(sentAtMs, nowMs, timezone) : null,
      },
    };
  });

  return { rows, nowMs, timezone };
}

function RemindersSummary({
  pendingTotal,
  lateTotal,
  openedTotal,
}: {
  pendingTotal: number;
  lateTotal: number;
  openedTotal: number;
}) {
  return (
    <div className="reminders-summary">
      <div className="reminder-summary-card" data-type="pending">
        <p className="reminder-summary-value">{pendingTotal}</p>
        <p className="reminder-summary-label">Pendentes</p>
      </div>
      <div className="reminder-summary-card" data-type="late">
        <p className="reminder-summary-value">{lateTotal}</p>
        <p className="reminder-summary-label">Atrasados</p>
      </div>
      <div className="reminder-summary-card" data-type="opened">
        <p className="reminder-summary-value">{openedTotal}</p>
        <p className="reminder-summary-label">WhatsApp aberto</p>
      </div>
    </div>
  );
}

function ReminderFilterChips({ active }: { active: FilterKey }) {
  return (
    <div className="reminder-filter-list">
      {FILTERS.map((filter) => (
        <Link
          key={filter.key}
          href={
            filter.key === 'all'
              ? '/dashboard/lembretes'
              : `/dashboard/lembretes?filter=${filter.key}`
          }
          className="reminder-filter-chip"
          data-active={filter.key === active || undefined}
        >
          {filter.label}
        </Link>
      ))}
    </div>
  );
}

type VisibleGroup = { key: string; label: string; items: ReminderRow[] };

// "opened" cuts across dates (a reminder can have its WhatsApp opened whether it's for
// today or next week), so unlike the other filters it isn't just one of
// groupReminders' own five buckets — it's a flat re-filter of the full set instead.
function filterGroups(
  allGroups: ReminderGroup<ReminderRow>[],
  allRows: ReminderRow[],
  filter: FilterKey,
): VisibleGroup[] {
  if (filter === 'all') return allGroups;
  if (filter === 'opened') {
    const items = allRows.filter((row) => row.badge === 'opened');
    return items.length > 0 ? [{ key: 'opened', label: 'WhatsApp aberto', items }] : [];
  }
  const match = allGroups.find((group) => group.key === filter);
  return match ? [match] : [];
}

export default async function LembretesPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { tenantId } = await requireProfile();
  const params = await searchParams;
  const filter = isFilterKey(params.filter) ? params.filter : 'all';

  const { rows, nowMs, timezone } = await loadReminders(tenantId);

  const pendingTotal = rows.filter((row) => row.badge !== 'marked_sent').length;
  const lateTotal = rows.filter((row) => row.badge === 'overdue').length;
  const openedTotal = rows.filter((row) => row.badge === 'opened').length;

  // NEX-171: "Métricas e alertas" — the "reminders pending overdue" metric. There's
  // no scheduled/cron job independent of the dona opening this page (unlike
  // cleanup-booking-drafts) — out of scope here, a real periodic check would be its
  // own task — so this is only a signal for whenever the page is actually loaded,
  // not a continuous count. `warn` only when there's something actually overdue, so
  // a normal empty-inbox page load doesn't add log noise at a level anyone would
  // filter alerts on.
  logEvent(
    lateTotal > 0 ? 'warn' : 'info',
    'reminders.page_loaded',
    { tenantId, pendingTotal, lateTotal, openedTotal },
    await getRequestId(),
  );

  const allGroups = groupReminders(rows, nowMs, timezone);
  const visibleGroups = filterGroups(allGroups, rows, filter);

  return (
    <div className="shell reminders-page">
      <header className="reminders-header">
        <Link href="/dashboard/mais" className="reminders-back-button" aria-label="Voltar a Mais">
          <ChevronLeft aria-hidden="true" size={20} />
        </Link>
        <h1 className="reminders-title">Lembretes</h1>
      </header>

      {filter === 'all' && pendingTotal === 0 ? (
        <div className="reminders-empty-state">
          <CheckCircle2 aria-hidden="true" size={22} />
          <p className="reminders-empty-title">Todos os lembretes estão em dia.</p>
          <p className="reminders-empty-subtitle">Não existem mensagens pendentes neste momento.</p>
        </div>
      ) : (
        <RemindersSummary
          pendingTotal={pendingTotal}
          lateTotal={lateTotal}
          openedTotal={openedTotal}
        />
      )}

      <ReminderFilterChips active={filter} />

      {visibleGroups.length === 0 ? (
        filter === 'all' && pendingTotal === 0 ? null : (
          <p className="reminders-empty-filtered">Ainda não existem lembretes para este período.</p>
        )
      ) : (
        visibleGroups.map((group) => (
          <section key={group.key}>
            <p className="reminder-group-title">
              {group.label}
              <span className="reminder-group-count">{group.items.length}</span>
            </p>
            <ul className="reminder-card-list">
              {group.items.map((row) => (
                <ReminderCard key={row.id} reminder={row.card} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
