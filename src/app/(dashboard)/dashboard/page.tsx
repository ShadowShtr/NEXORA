import Link from 'next/link';
import type { Route } from 'next';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import {
  Bell,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  MessageCircle,
  Share2,
  Wallet,
} from 'lucide-react';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { logEvent } from '@/lib/logger';
import { getRequestId } from '@/lib/request-id';
import { publicBookingUrl } from '@/features/onboarding/domain/publish-step';
import {
  APPOINTMENT_STATUS_LABELS,
  buildAppointmentReminderMessage,
  buildWhatsappDeepLink,
} from '@/features/appointments/domain/appointment-card';
import { AttentionWhatsappButton } from '@/features/dashboard/AttentionWhatsappButton';
import {
  buildDashboardSummary,
  type AppointmentSummary,
  type DashboardSummary,
} from '@/features/dashboard/domain/summary';
import {
  dashboardSummaryRpcSchema,
  mapAppointmentsToday,
  mapAttentionReminders,
} from '@/features/dashboard/domain/summary-rpc';

const AGENDA_PREVIEW_LIMIT = 4;
// The attention-reminders equivalent of this limit now lives in
// supabase/migrations/0039_dashboard_summary_rpc.sql (`limit 4`, attention_reminders
// CTE) — the RPC does the limiting in SQL now, not a `.slice()`/`.limit()` here.

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

// Used for both the reminder's own appointment date and (previously) the reminder's
// due_at — now only the former, since the redesigned attention row shows "Amanhã, 08:30
// · Manicure Gel" (the appointment itself), not an abstract reminder due-date.
function relativeDayLabel(dateMs: number, nowMs: number, timezone: string): string {
  const dateKey = formatInTimeZone(dateMs, timezone, 'yyyy-MM-dd');
  const todayKey = formatInTimeZone(nowMs, timezone, 'yyyy-MM-dd');
  const tomorrowKey = formatInTimeZone(nowMs + 24 * 60 * 60_000, timezone, 'yyyy-MM-dd');
  if (dateKey === todayKey) return 'Hoje';
  if (dateKey === tomorrowKey) return 'Amanhã';
  return formatInTimeZone(dateMs, timezone, 'dd MMM', { locale: pt });
}

type AttentionReminder = {
  id: string;
  appointmentId: string | null;
  clientName: string;
  startAtMs: number | null;
  itemDescriptions: string[];
  whatsappHref: string | null;
};

// Data loading (including the Date.now() read) lives outside the component body: the
// React Compiler purity rule forbids impure calls directly in render, since a component
// must be safely re-callable. This is a plain async function the Server Component
// calls once, not a component itself, so the rule doesn't apply to it.
// PR3: this used to also fetch `profiles.display_name` and `tenants.slug` itself, two
// redundant queries — both are already resolved by the caller's memoized auth context
// (requireProfile(), which shares getAuthContext() with the layout above this page in
// the same request), so this function only fetches what it alone needs. See
// docs/audits/NEXORA_PERFORMANCE_AUDIT.md (PR3 update, "duplicações removidas").
//
// PR4: the appointments/reminders-count/payments-paid/attention-reminders fan-out (4
// parallel Supabase calls + a 5th dependent one for today's pending payments, 5
// operations total) is now one call to get_dashboard_summary_v1 (supabase/migrations/
// 0039_dashboard_summary_rpc.sql) — same values, same rules, moved to Postgres. See
// docs/audits/NEXORA_PERFORMANCE_AUDIT.md (PR4 update) for the full before/after and
// the equivalence tests. buildDashboardSummary() itself (nextAppointment selection,
// todayCount, invoicedTodayCents) is untouched — it's pure JS aggregation over
// appointmentsToday that was already unit-tested and has nothing to do with how many
// round trips fetched that array.
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

  const rpcStartedAtMs = Date.now();
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_summary_v1', {
    p_day_start: dayStartIso,
    p_day_end: dayEndIso,
  });
  const rpcDurationMs = Date.now() - rpcStartedAtMs;

  // Section 15/16 of this PR's brief: an RPC error or an unexpected shape must never
  // silently fall back to an empty Dashboard — that would look like "no appointments
  // today" instead of "something is broken". Logged (tenantId + duration + outcome
  // only — no SQL, no row contents, matching this codebase's existing logEvent()
  // convention, e.g. dashboard/lembretes/page.tsx) and re-thrown, same as any other
  // unhandled error in this codebase (no bespoke Dashboard error boundary exists —
  // Next's default error UI takes over, consistent with every other page here).
  if (rpcError) {
    logEvent(
      'error',
      'dashboard.summary_rpc_failed',
      { tenantId, durationMs: rpcDurationMs, errorCode: rpcError.code ?? 'unknown' },
      await getRequestId(),
    );
    throw new Error('Failed to load dashboard summary');
  }

  const parsed = dashboardSummaryRpcSchema.safeParse(rpcData);
  if (!parsed.success) {
    logEvent(
      'error',
      'dashboard.summary_rpc_shape_invalid',
      { tenantId, durationMs: rpcDurationMs },
      await getRequestId(),
    );
    throw new Error('Unexpected dashboard summary shape');
  }

  logEvent(
    'info',
    'dashboard.summary_rpc_loaded',
    { tenantId, durationMs: rpcDurationMs },
    await getRequestId(),
  );

  const appointmentsToday: AppointmentSummary[] = mapAppointmentsToday(
    parsed.data.appointments_today,
  );
  const rawAttentionReminders = mapAttentionReminders(parsed.data.attention_reminders);

  const summary = buildDashboardSummary(
    appointmentsToday,
    parsed.data.pending_reminders_count,
    parsed.data.received_today_cents,
    parsed.data.pending_today_cents,
    nowMs,
    parsed.data.pending_payments_today_count,
  );

  const attentionReminders: AttentionReminder[] = rawAttentionReminders.map((reminder) => {
    const whatsappHref =
      reminder.clientPhoneE164 && reminder.startAtMs !== null
        ? buildWhatsappDeepLink(
            reminder.clientPhoneE164,
            buildAppointmentReminderMessage(
              reminder.clientName,
              formatInTimeZone(reminder.startAtMs, timezone, 'HH:mm'),
            ),
          )
        : null;
    return {
      id: reminder.id,
      appointmentId: reminder.appointmentId,
      clientName: reminder.clientName,
      startAtMs: reminder.startAtMs,
      itemDescriptions: reminder.itemDescriptions,
      whatsappHref,
    };
  });

  return {
    summary,
    timezone,
    nowMs,
    appointmentsToday,
    attentionReminders,
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
      <div className="next-client-card" data-empty="true">
        <p className="next-client-label">Próxima cliente</p>
        <div className="next-client-empty">
          <p className="next-client-empty-message">Sem marcações agendadas para hoje.</p>
          <Link href="/dashboard/agenda/nova" className="next-client-empty-action">
            + Criar marcação
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="next-client-card">
      <p className="next-client-label">Próxima cliente</p>
      <div className="next-client-content">
        <span className="next-client-time">
          {formatInTimeZone(nextAppointment.startAtMs, timezone, 'HH:mm')}
        </span>
        <span className="next-client-info">
          <span className="next-client-name">{nextAppointment.clientName}</span>
          {nextAppointment.itemDescriptions.length > 0 ? (
            <span className="next-client-services">
              {nextAppointment.itemDescriptions.join(', ')}
            </span>
          ) : null}
          <span className="next-client-value">{formatEuros(nextAppointment.totalCents)}</span>
        </span>
        <span className="next-client-state">
          {minutesUntilLabel(nextAppointment.startAtMs, nowMs)}
        </span>
      </div>
      <Link href={`/dashboard/agenda/${nextAppointment.id}`} className="next-client-button">
        Ver detalhes
      </Link>
    </div>
  );
}

function SectionHeader({
  title,
  actionHref,
  actionLabel,
}: {
  title: string;
  actionHref: Route;
  actionLabel: string;
}) {
  return (
    <div className="home-section-header">
      <h2>{title}</h2>
      <Link href={actionHref} className="home-section-link">
        {actionLabel}
      </Link>
    </div>
  );
}

function DailySummaryGrid({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="daily-summary-grid">
      <div className="summary-card" data-type="appointments">
        <span className="summary-icon" aria-hidden="true">
          <Calendar size={20} />
        </span>
        <span className="summary-text">
          <span className="summary-value">{summary.todayCount}</span>
          <span className="summary-label">
            Marcações
            <br />
            Hoje
          </span>
        </span>
      </div>
      <div className="summary-card" data-type="revenue">
        <span className="summary-icon" aria-hidden="true">
          <Wallet size={20} />
        </span>
        <span className="summary-text">
          <span className="summary-value">{formatEuros(summary.invoicedTodayCents)}</span>
          <span className="summary-label">
            Faturação
            <br />
            Hoje
          </span>
        </span>
      </div>
      <div className="summary-card" data-type="reminders">
        <span className="summary-icon" aria-hidden="true">
          <Bell size={20} />
        </span>
        <span className="summary-text">
          <span className="summary-value">{summary.pendingRemindersCount}</span>
          <span className="summary-label">
            Lembretes
            <br />
            Hoje
          </span>
        </span>
      </div>
      <div className="summary-card" data-type="pending">
        <span className="summary-icon" aria-hidden="true">
          <ClipboardList size={20} />
        </span>
        <span className="summary-text">
          <span className="summary-value">{summary.pendingPaymentsTodayCount}</span>
          <span className="summary-label">
            Pendentes
            <br />
            Hoje
          </span>
        </span>
      </div>
    </div>
  );
}

// "Precisa da sua atenção" (renamed from "Lembretes"): the reference also suggests
// pagamentos pendentes/clientes que faltaram/conflitos na agenda as future item types,
// but none of those are queryable, real states in this schema today — pending payments
// already surface in the summary grid above, "no_show" has no follow-up workflow yet,
// and double-booking is prevented at the DB level (appointments_no_overlap exclusion
// constraint), so there is no "conflict" state that could ever exist to show. Only real
// pending reminders are listed here, same data source as before, just restyled.
function AttentionSection({
  reminders,
  timezone,
  nowMs,
}: {
  reminders: AttentionReminder[];
  timezone: string;
  nowMs: number;
}) {
  return (
    <div className="reminders-card">
      {reminders.length === 0 ? (
        <div className="reminder-item reminder-item-empty">
          <span className="reminder-icon" aria-hidden="true">
            <CheckCircle2 size={17} />
          </span>
          <span className="reminder-client-name">Todos os lembretes estão em dia.</span>
        </div>
      ) : (
        reminders.map((reminder) => (
          <div key={reminder.id} className="reminder-item">
            <span className="reminder-icon" aria-hidden="true">
              <Bell size={17} />
            </span>
            <span className="reminder-text">
              <span className="reminder-client-name">{reminder.clientName}</span>
              <span className="reminder-details">
                {reminder.startAtMs !== null
                  ? `${relativeDayLabel(reminder.startAtMs, nowMs, timezone)}, ${formatInTimeZone(reminder.startAtMs, timezone, 'HH:mm')}`
                  : ''}
                {reminder.itemDescriptions.length > 0
                  ? ` · ${reminder.itemDescriptions.join(', ')}`
                  : ''}
              </span>
            </span>
            <span className="reminder-actions">
              {reminder.whatsappHref ? (
                <AttentionWhatsappButton
                  reminderId={reminder.id}
                  whatsappHref={reminder.whatsappHref}
                  clientName={reminder.clientName}
                />
              ) : null}
              {reminder.appointmentId ? (
                <Link
                  href={`/dashboard/agenda/${reminder.appointmentId}`}
                  className="reminder-chevron"
                  aria-label={`Ver marcação de ${reminder.clientName}`}
                >
                  <ChevronRight aria-hidden="true" size={18} />
                </Link>
              ) : null}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

// Only rendered when there is at least one appointment today (see call site) — an empty
// day already says so via NextClientCard's own empty state immediately above, so a
// second, separate "sem marcações" message here would just repeat it.
function TodayAgendaPreview({
  appointments,
  timezone,
}: {
  appointments: AppointmentSummary[];
  timezone: string;
}) {
  const isActive = (status: string) => status === 'confirmed' || status === 'presence_confirmed';

  return (
    <div className="today-agenda-card">
      {appointments.slice(0, AGENDA_PREVIEW_LIMIT).map((appointment) => {
        const active = isActive(appointment.status);
        const whatsappHref =
          active && appointment.clientPhoneE164
            ? buildWhatsappDeepLink(
                appointment.clientPhoneE164,
                buildAppointmentReminderMessage(
                  appointment.clientName,
                  formatInTimeZone(appointment.startAtMs, timezone, 'HH:mm'),
                ),
              )
            : null;

        return (
          <div key={appointment.id} className="today-agenda-item">
            <span className="today-agenda-time">
              {formatInTimeZone(appointment.startAtMs, timezone, 'HH:mm')}
            </span>
            <Link href={`/dashboard/agenda/${appointment.id}`} className="today-agenda-info">
              <span className="today-agenda-name">{appointment.clientName}</span>
              {appointment.itemDescriptions.length > 0 ? (
                <span className="today-agenda-services">
                  {appointment.itemDescriptions.join(', ')}
                </span>
              ) : null}
              {!active ? (
                <span className="today-agenda-status">
                  {APPOINTMENT_STATUS_LABELS[
                    appointment.status as keyof typeof APPOINTMENT_STATUS_LABELS
                  ] ?? appointment.status}
                </span>
              ) : null}
            </Link>
            <span className="today-agenda-actions">
              {whatsappHref ? (
                <a
                  className="today-agenda-whatsapp"
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Abrir WhatsApp com ${appointment.clientName}`}
                >
                  <MessageCircle aria-hidden="true" size={17} />
                </a>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// NEX-080: "Próxima cliente aparece em destaque. Cartões mostram atendimentos por
// hora." (docs/02_UX_FLOWS.md, Fluxo C). requireProfile() (dashboard layout) already
// gates this page to an authenticated, provisioned owner and derives tenantId from
// their session — every query in loadDashboardData filters by it, and createClient()
// (cookie-scoped, RLS-enforced) is the same client every other authenticated dashboard
// page already uses, so there is no new authorization surface here.
//
// Visual refinement mid-2026: reduced the page to a compact operational panel (safe
// area → header → next client → compact summary → attention → today's agenda preview →
// shortcuts), matching the density already shipped for Agenda/Clientes/Serviços/Mais.
// "Atalhos rápidos" keeps the two shortcuts that lead somewhere real today (nova
// marcação, link da página) — "novo cliente" and "venda rápida" still have no dedicated
// flow of their own (Clientes' own rule: reuse nova marcação, don't invent a second
// creation destination), so there is nothing genuine to add as a third/fourth shortcut,
// and no bottom sheet is needed for a list of exactly two items. There is no floating
// add button on this page (never was), so the reference's "hide the FAB" rule is
// already true by construction.
export default async function DashboardPage() {
  const { tenantId, displayName, tenantSlug } = await requireProfile();
  const { summary, timezone, nowMs, appointmentsToday, attentionReminders } =
    await loadDashboardData(tenantId);
  const publicUrl = tenantSlug ? publicBookingUrl(publicEnv.NEXT_PUBLIC_APP_URL, tenantSlug) : null;

  return (
    <div className="shell home-page">
      <header className="home-header">
        <div>
          <h1 className="home-greeting">
            Olá{displayName ? `, ${firstName(displayName)}` : ''}!{' '}
            <span className="home-greeting-emoji">👋</span>
          </h1>
          <p className="home-date">
            {capitalize(formatInTimeZone(nowMs, timezone, "EEEE, dd 'de' MMMM", { locale: pt }))}
          </p>
        </div>
        <Link
          href="/dashboard/lembretes"
          className="home-notification-button"
          aria-label={
            summary.pendingRemindersCount > 0
              ? `Lembretes (${summary.pendingRemindersCount} pendentes)`
              : 'Lembretes'
          }
        >
          <Bell aria-hidden="true" size={20} />
          {summary.pendingRemindersCount > 0 ? (
            <span className="home-notification-badge" aria-hidden="true" />
          ) : null}
        </Link>
      </header>

      <NextClientCard nextAppointment={summary.nextAppointment} timezone={timezone} nowMs={nowMs} />

      <p className="home-section-title">Resumo do dia</p>
      <DailySummaryGrid summary={summary} />

      <SectionHeader
        title="Precisa da sua atenção"
        actionHref="/dashboard/lembretes"
        actionLabel="Ver todos"
      />
      <AttentionSection reminders={attentionReminders} timezone={timezone} nowMs={nowMs} />

      {appointmentsToday.length > 0 ? (
        <>
          <SectionHeader
            title="Agenda de hoje"
            actionHref="/dashboard/agenda"
            actionLabel="Ver agenda"
          />
          <TodayAgendaPreview appointments={appointmentsToday} timezone={timezone} />
        </>
      ) : null}

      <p className="quick-actions-title">Atalhos rápidos</p>
      <div className="quick-actions-grid">
        <Link href="/dashboard/agenda/nova" className="quick-action-card">
          <CalendarPlus aria-hidden="true" size={23} />
          <span className="quick-action-label">Nova marcação</span>
        </Link>
        {publicUrl ? (
          <a href={publicUrl} target="_blank" rel="noreferrer" className="quick-action-card">
            <Share2 aria-hidden="true" size={23} />
            <span className="quick-action-label">Link da página</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}
