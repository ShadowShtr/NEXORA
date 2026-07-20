import { formatInTimeZone } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { resolveReminderBadge } from '@/features/reminders/domain/reminder-badges';
import { buildWhatsappDeepLink } from '@/features/appointments/domain/appointment-card';
import { ReminderCard, type ReminderCardData } from '@/features/reminders/ReminderCard';
import {
  DEFAULT_REMINDER_TEMPLATE,
  renderReminderTemplate,
} from '@/features/reminders/domain/template';

const PAGE_SIZE = 20;

function pageHref(page: number) {
  return page > 1 ? `/dashboard/lembretes?page=${page}` : '/dashboard/lembretes';
}

// Data loading (including the Date.now() read) lives outside the component body — see
// the same purity-rule note in src/app/(dashboard)/dashboard/page.tsx (NEX-080).
async function loadReminders(tenantId: string, page: number) {
  const nowMs = Date.now();
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('business_settings')
    .select('timezone, reminder_message_template')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const timezone = settings?.timezone ?? 'Europe/Lisbon';
  const messageTemplate = settings?.reminder_message_template ?? DEFAULT_REMINDER_TEMPLATE;

  const from = (page - 1) * PAGE_SIZE;
  const { data: reminders, count } = await supabase
    .from('reminders')
    .select(
      'id, due_at, status, opened_at, marked_sent_at, appointments(id, start_at, clients(name, phone_e164))',
      { count: 'exact' },
    )
    .eq('tenant_id', tenantId)
    .neq('status', 'skipped')
    .order('due_at')
    .range(from, from + PAGE_SIZE - 1);

  return { reminders: reminders ?? [], total: count ?? 0, timezone, nowMs, messageTemplate };
}

// NEX-101: "Lista de lembretes pendentes" (docs/01_PRODUCT_REQUIREMENTS.md §8) —
// requireProfile() (dashboard layout) gates this page to an authenticated, provisioned
// owner and derives tenantId from their session; every query filters by it (RLS via
// createClient() enforces this too, as defense in depth). Skipped reminders (a
// cancelled/no_show appointment, NEX-100) are excluded here — there is nothing left
// for the dona to act on for those, unlike marked_sent which stays visible as a record
// of what was already handled.
export default async function LembretesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { tenantId } = await requireProfile();
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);

  const { reminders, total, timezone, nowMs, messageTemplate } = await loadReminders(
    tenantId,
    page,
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="shell">
      <p className="eyebrow">Lembretes</p>
      <h1>Lembretes</h1>

      {reminders.length === 0 ? (
        <Card>
          <p>Sem lembretes pendentes.</p>
        </Card>
      ) : (
        <>
          <ul className="appointment-card-list">
            {reminders.map((reminder) => {
              const appointment = Array.isArray(reminder.appointments)
                ? reminder.appointments[0]
                : reminder.appointments;
              const client = appointment
                ? Array.isArray(appointment.clients)
                  ? appointment.clients[0]
                  : appointment.clients
                : null;
              const badge = resolveReminderBadge(
                reminder.status as 'pending' | 'opened' | 'marked_sent' | 'skipped',
                new Date(reminder.due_at).getTime(),
                nowMs,
              );

              const whatsappHref =
                appointment && client?.phone_e164
                  ? buildWhatsappDeepLink(
                      client.phone_e164,
                      renderReminderTemplate(messageTemplate, {
                        clientName: client.name ?? 'Cliente',
                        dateLabel: formatInTimeZone(appointment.start_at, timezone, 'dd/MM', {
                          locale: pt,
                        }),
                        timeLabel: formatInTimeZone(appointment.start_at, timezone, 'HH:mm', {
                          locale: pt,
                        }),
                      }),
                    )
                  : null;

              const cardData: ReminderCardData = {
                reminderId: reminder.id,
                appointmentId: appointment?.id ?? null,
                clientName: client?.name ?? 'Cliente',
                timeLabel: appointment
                  ? formatInTimeZone(appointment.start_at, timezone, "dd/MM 'às' HH:mm", {
                      locale: pt,
                    })
                  : '—',
                badge,
                whatsappHref,
              };

              return <ReminderCard key={reminder.id} reminder={cardData} />;
            })}
          </ul>

          {totalPages > 1 ? (
            <nav className="agenda-date-nav" aria-label="Paginação de lembretes">
              {page > 1 ? (
                <a href={pageHref(page - 1)} className="button-secondary button">
                  Anterior
                </a>
              ) : (
                <span className="button-secondary button link-disabled" aria-disabled="true">
                  Anterior
                </span>
              )}
              <span className="agenda-range-label">
                Página {page} de {totalPages}
              </span>
              {page < totalPages ? (
                <a href={pageHref(page + 1)} className="button-secondary button">
                  Seguinte
                </a>
              ) : (
                <span className="button-secondary button link-disabled" aria-disabled="true">
                  Seguinte
                </span>
              )}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
