import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, MessageCircle } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { initials } from '@/lib/initials';
import { AppointmentPrimaryActions } from '@/features/appointments/AppointmentPrimaryActions';
import { AppointmentSecondaryActions } from '@/features/appointments/AppointmentSecondaryActions';
import { AppointmentDangerZone } from '@/features/appointments/AppointmentDangerZone';
import {
  APPOINTMENT_STATUS_LABELS,
  buildWhatsappDeepLink,
  type AppointmentCardStatus,
} from '@/features/appointments/domain/appointment-card';
import {
  bookingBadgeTone,
  formatDurationLabel,
  paymentSummaryLabel,
} from '@/features/appointments/domain/appointment-detail';
import {
  REMINDER_BADGE_LABELS,
  resolveReminderBadge,
} from '@/features/reminders/domain/reminder-badges';

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function capitalize(label: string): string {
  return label.length === 0 ? label : label[0]!.toUpperCase() + label.slice(1);
}

// Visual refinement mid-2026 — "Detalhes da marcação" deixa de ser uma listagem de
// texto corrido dentro de um único cartão gigante e passa a ser uma ficha operacional:
// resumo de hora/cliente no cartão principal, serviços num cartão próprio, informações
// complementares (estado/pagamento/lembrete/criada em/observação) numa coluna lateral no
// desktop, e ações agrupadas por intenção (Reagendar+WhatsApp como principais, Ver
// cliente/Duplicar/Copiar contacto como secundárias, Cancelar/Marcar falta numa zona de
// risco recolhida por omissão). NEX-084/115/123/143's server actions (detail-actions.ts)
// são reaproveitadas sem alteração — só a apresentação mudou.
// Reads here, inside a plain async function the component calls once — not in the
// component body itself, where the React Compiler purity rule forbids an impure call
// like Date.now() (same convention as dashboard/page.tsx's loadDashboardData and
// b/[slug]/page.tsx's loadPublicProfile).
async function loadAppointmentDetail(id: string, tenantId: string) {
  const supabase = await createClient();

  const [{ data: appointment }, { data: settings }, { data: payment }, { data: reminder }] =
    await Promise.all([
      supabase
        .from('appointments')
        .select(
          'id, start_at, end_at, status, expected_total_cents, final_total_cents, client_observation, client_id, recurring_series_id, created_at, clients(name, phone_e164), appointment_items(description, unit_price_cents, duration_minutes, quantity)',
        )
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      supabase.from('business_settings').select('timezone').eq('tenant_id', tenantId).maybeSingle(),
      supabase
        .from('payments')
        .select('status, method')
        .eq('appointment_id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      supabase
        .from('reminders')
        .select('status, due_at, opened_at')
        .eq('appointment_id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle(),
    ]);

  return { appointment, settings, payment, reminder, nowMs: Date.now() };
}

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenantId } = await requireProfile();
  const { id } = await params;
  const { appointment, settings, payment, reminder, nowMs } = await loadAppointmentDetail(
    id,
    tenantId,
  );

  if (!appointment) notFound();

  const timezone = settings?.timezone ?? 'Europe/Lisbon';
  const client = Array.isArray(appointment.clients) ? appointment.clients[0] : appointment.clients;
  const status = appointment.status as AppointmentCardStatus;
  const isActive = status === 'confirmed' || status === 'presence_confirmed';
  const canReopen = status === 'completed';
  const totalCents = appointment.final_total_cents ?? appointment.expected_total_cents;
  const items = appointment.appointment_items ?? [];
  const totalMinutes = items.reduce((sum, item) => sum + item.duration_minutes, 0);

  const dateLabel = capitalize(
    formatInTimeZone(appointment.start_at, timezone, "EEEE, dd 'de' MMMM", { locale: pt }),
  );
  const startTimeLabel = formatInTimeZone(appointment.start_at, timezone, 'HH:mm');

  const whatsappHref = client?.phone_e164
    ? buildWhatsappDeepLink(
        client.phone_e164,
        `Olá ${client.name}! Sobre a sua marcação de ${dateLabel.toLowerCase()} às ${startTimeLabel}.`,
      )
    : null;

  const reminderBadge = reminder
    ? resolveReminderBadge(
        reminder.status as 'pending' | 'opened' | 'marked_sent' | 'skipped',
        new Date(reminder.due_at).getTime(),
        nowMs,
      )
    : null;

  return (
    <div className="booking-details-page">
      <header className="booking-details-header">
        <Link href="/dashboard/agenda" className="booking-details-back" aria-label="Voltar">
          <ArrowLeft size={18} aria-hidden="true" />
        </Link>
        <div>
          <h1 className="booking-details-title">Detalhes da marcação</h1>
          <p className="booking-details-subtitle">{dateLabel}</p>
        </div>
        <span className="booking-status" data-tone={bookingBadgeTone(status)}>
          {APPOINTMENT_STATUS_LABELS[status].toUpperCase()}
        </span>
      </header>

      <div className="booking-details-layout">
        <main>
          <div className="booking-main-card">
            <div className="booking-time-summary">
              <span className="booking-time-icon" aria-hidden="true">
                <CalendarDays size={22} />
              </span>
              <div>
                <span className="booking-time">{startTimeLabel}</span>
                <span className="booking-date">{dateLabel}</span>
              </div>
              {totalMinutes > 0 ? (
                <span className="booking-duration">{formatDurationLabel(totalMinutes)}</span>
              ) : null}
            </div>

            <div className="booking-client">
              <span className="booking-client-avatar" aria-hidden="true">
                {initials(client?.name ?? '?')}
              </span>
              <span className="booking-client-content">
                <span className="booking-client-name">{client?.name ?? 'Cliente'}</span>
                {client?.phone_e164 ? (
                  <span className="booking-client-phone">{client.phone_e164}</span>
                ) : null}
              </span>
              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="booking-whatsapp-button"
                  aria-label="Abrir WhatsApp"
                >
                  <MessageCircle size={19} aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>

          {items.length > 0 ? (
            <section className="booking-services-card">
              <div className="booking-section-header">
                <h2>Serviços</h2>
                <span className="booking-section-count">
                  {items.length === 1 ? '1 selecionado' : `${items.length} selecionados`}
                </span>
              </div>

              {items.map((item, index) => (
                <div key={index} className="booking-service-row">
                  <span className="booking-service-name">{item.description}</span>
                  <span className="booking-service-price">
                    {formatEuros(item.unit_price_cents * item.quantity)}
                  </span>
                </div>
              ))}

              <div className="booking-total">
                <div className="booking-total-item">
                  <span>Duração total</span>
                  <strong>{formatDurationLabel(totalMinutes)}</strong>
                </div>
                <div className="booking-total-item" data-type="price">
                  <span>Total estimado</span>
                  <strong>{formatEuros(totalCents)}</strong>
                </div>
              </div>
            </section>
          ) : null}

          <AppointmentPrimaryActions
            appointmentId={appointment.id}
            timezone={timezone}
            totalMinutes={totalMinutes}
            canReschedule={isActive}
            whatsappHref={whatsappHref}
          />
          <AppointmentSecondaryActions
            appointmentId={appointment.id}
            clientId={appointment.client_id}
            phoneE164={client?.phone_e164 ?? null}
            canReopen={canReopen}
          />
          <AppointmentDangerZone
            appointmentId={appointment.id}
            recurringSeriesId={appointment.recurring_series_id}
            canCancel={isActive}
          />
        </main>

        <aside className="booking-details-sidebar">
          <div className="booking-information-card">
            <div className="booking-information-row">
              <span>Estado</span>
              <span>{APPOINTMENT_STATUS_LABELS[status]}</span>
            </div>
            <div className="booking-information-row">
              <span>Pagamento</span>
              <span>
                {paymentSummaryLabel(
                  payment
                    ? {
                        status: payment.status as 'pending' | 'paid' | 'refunded',
                        method: payment.method as 'cash' | 'mbway' | null,
                      }
                    : null,
                )}
              </span>
            </div>
            {reminderBadge ? (
              <div className="booking-information-row">
                <span>Lembrete</span>
                <span>{REMINDER_BADGE_LABELS[reminderBadge]}</span>
              </div>
            ) : null}
            <div className="booking-information-row">
              <span>Criada em</span>
              <span>
                {formatInTimeZone(appointment.created_at, timezone, "dd 'de' MMMM 'às' HH:mm", {
                  locale: pt,
                })}
              </span>
            </div>
            <div className="booking-information-row">
              <span>Observação</span>
              <span>{appointment.client_observation || 'Nenhuma'}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
