import { notFound } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { AppointmentDetailActions } from '@/features/appointments/AppointmentDetailActions';
import {
  APPOINTMENT_STATUS_LABELS,
  type AppointmentCardStatus,
} from '@/features/appointments/domain/appointment-card';

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function capitalize(label: string): string {
  return label.length === 0 ? label : label[0]!.toUpperCase() + label.slice(1);
}

// NEX-084: "Detalhes, cancelar e reagendar" — requireProfile() gates this page to an
// authenticated, provisioned owner and derives tenantId from their session; the
// appointment lookup below filters by it (RLS via createClient() enforces this too, as
// defense in depth) — a tenant can never view or act on another tenant's appointment,
// even by guessing its id.
export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenantId } = await requireProfile();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: appointment }, { data: settings }] = await Promise.all([
    supabase
      .from('appointments')
      .select(
        'id, start_at, end_at, status, expected_total_cents, final_total_cents, client_observation, clients(name, phone_e164), appointment_items(description, unit_price_cents, quantity)',
      )
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase.from('business_settings').select('timezone').eq('tenant_id', tenantId).maybeSingle(),
  ]);

  if (!appointment) notFound();

  const timezone = settings?.timezone ?? 'Europe/Lisbon';
  const client = Array.isArray(appointment.clients) ? appointment.clients[0] : appointment.clients;
  const status = appointment.status as AppointmentCardStatus;
  const isActive = status === 'confirmed' || status === 'presence_confirmed';
  const totalCents = appointment.final_total_cents ?? appointment.expected_total_cents;

  return (
    <div className="shell">
      <p className="eyebrow">Agenda</p>
      <h1>Detalhes da marcação</h1>

      <Card className="public-summary">
        <p className="public-step-label">{APPOINTMENT_STATUS_LABELS[status]}</p>
        <p className="public-summary-total">
          {capitalize(
            formatInTimeZone(appointment.start_at, timezone, "EEEE, dd 'de' MMMM 'às' HH:mm", {
              locale: pt,
            }),
          )}
        </p>
        <p className="appointment-card-client">{client?.name ?? 'Cliente'}</p>
        {client?.phone_e164 ? <p className="appointment-card-items">{client.phone_e164}</p> : null}

        {(appointment.appointment_items ?? []).length > 0 ? (
          <ul className="public-service-list">
            {(appointment.appointment_items ?? []).map((item, index) => (
              <li key={index} className="public-service-item">
                <span>{item.description}</span>
                <span className="public-service-meta">{formatEuros(item.unit_price_cents)}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="public-summary-total">Total: {formatEuros(totalCents)}</p>

        {appointment.client_observation ? (
          <p className="appointment-card-items">{appointment.client_observation}</p>
        ) : null}
      </Card>

      <AppointmentDetailActions
        appointmentId={appointment.id}
        canCancel={isActive}
        canReschedule={isActive}
      />
    </div>
  );
}
