import { notFound } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { parseClientPreferences } from '@/features/clients/domain/preferences';
import { ClientPreferencesForm } from '@/features/clients/ClientPreferencesForm';
import { ClientPrivateNotesForm } from '@/features/clients/ClientPrivateNotesForm';
import { countRecentNoShows, exceedsNoShowLimit } from '@/features/clients/domain/no-show-policy';

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function capitalize(label: string): string {
  return label.length === 0 ? label : label[0]!.toUpperCase() + label.slice(1);
}

const PAYMENT_METHOD_LABELS: Record<string, string> = { cash: 'Dinheiro', mbway: 'MB WAY' };

// Data loading (including the Date.now() read) lives outside the component body — see
// the same purity-rule note in src/app/(dashboard)/dashboard/page.tsx (NEX-080).
async function loadClientDetail(tenantId: string, clientId: string) {
  const supabase = await createClient();

  const [{ data: client }, { data: settings }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, phone_e164, email, preferences, private_notes, first_seen_at')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase
      .from('business_settings')
      .select('timezone, no_show_limit, no_show_window_days')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ]);

  if (!client) return null;

  const timezone = settings?.timezone ?? 'Europe/Lisbon';

  const { data: appointments } = await supabase
    .from('appointments')
    .select(
      'id, start_at, status, expected_total_cents, final_total_cents, appointment_items(description), payments(method, status)',
    )
    .eq('client_id', client.id)
    .eq('tenant_id', tenantId)
    .order('start_at', { ascending: false });

  const allAppointments = appointments ?? [];
  const nowMs = Date.now();
  const past = allAppointments.filter((a) => new Date(a.start_at).getTime() <= nowMs);
  const upcoming = allAppointments
    .filter(
      (a) =>
        new Date(a.start_at).getTime() > nowMs &&
        (a.status === 'confirmed' || a.status === 'presence_confirmed'),
    )
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const firstAppointment = allAppointments[allAppointments.length - 1] ?? null;
  const lastCompleted = past.find((a) => a.status === 'completed') ?? past[0] ?? null;
  const nextAppointment = upcoming[0] ?? null;

  const noShowCount = allAppointments.filter((a) => a.status === 'no_show').length;
  const cancelledCount = allAppointments.filter((a) => a.status === 'cancelled').length;

  const noShowWindowDays = settings?.no_show_window_days ?? 90;
  const recentNoShowCount = countRecentNoShows(
    allAppointments.map((a) => ({ status: a.status, startAt: a.start_at })),
    noShowWindowDays,
    nowMs,
  );
  const noShowLimitExceeded = exceedsNoShowLimit(recentNoShowCount, {
    limit: settings?.no_show_limit ?? null,
    windowDays: noShowWindowDays,
  });

  const totalSpentCents = allAppointments
    .filter((a) => a.status === 'completed')
    .reduce((sum, a) => sum + (a.final_total_cents ?? a.expected_total_cents), 0);

  const lastPaymentMethod = past
    .flatMap((a) => a.payments ?? [])
    .find((p) => p.status === 'paid')?.method;

  return {
    client,
    timezone,
    allAppointments,
    firstAppointment,
    lastCompleted,
    nextAppointment,
    noShowCount,
    cancelledCount,
    totalSpentCents,
    lastPaymentMethod,
    recentNoShowCount,
    noShowWindowDays,
    noShowLimitExceeded,
  };
}

// NEX-091: "Resumo, histórico, preferências, faltas, valores"
// (docs/01_PRODUCT_REQUIREMENTS.md §10: "dados de contacto; primeira, última e próxima
// marcação; histórico de serviços e valores; faltas, cancelamentos e reagendamentos;
// forma de pagamento; preferências; observações privadas; fotografias internas" — the
// last two are NEX-093/094, out of scope here but the layout leaves room for them).
// requireProfile() + a tenant_id filter on the client lookup keeps a tenant from ever
// viewing another tenant's client by guessing an id — RLS (createClient(), cookie-
// scoped) enforces the same thing as defense in depth.
export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId } = await requireProfile();
  const { id } = await params;
  const detail = await loadClientDetail(tenantId, id);
  if (!detail) notFound();

  const {
    client,
    timezone,
    allAppointments,
    firstAppointment,
    lastCompleted,
    nextAppointment,
    noShowCount,
    cancelledCount,
    totalSpentCents,
    lastPaymentMethod,
    recentNoShowCount,
    noShowWindowDays,
    noShowLimitExceeded,
  } = detail;

  const preferences = parseClientPreferences(client.preferences);

  function formatDate(iso: string) {
    return capitalize(formatInTimeZone(iso, timezone, "dd 'de' MMMM 'de' yyyy", { locale: pt }));
  }

  return (
    <div className="shell">
      <p className="text-eyebrow">Clientes</p>
      <h1 className="text-title">{client.name}</h1>

      {noShowLimitExceeded ? (
        <Card className="form-error">
          <p role="alert">
            Esta cliente teve {recentNoShowCount} faltas nos últimos {noShowWindowDays} dias,
            atingindo o limite definido nas definições do negócio.
          </p>
        </Card>
      ) : null}

      <Card>
        <p className="text-eyebrow">Contacto</p>
        <p>{client.phone_e164}</p>
        {client.email ? <p>{client.email}</p> : null}
      </Card>

      <Card>
        <p className="text-eyebrow">Resumo</p>
        <p>Primeira marcação: {firstAppointment ? formatDate(firstAppointment.start_at) : '—'}</p>
        <p>Última marcação: {lastCompleted ? formatDate(lastCompleted.start_at) : '—'}</p>
        <p>
          Próxima marcação:{' '}
          {nextAppointment ? (
            <a href={`/dashboard/agenda/${nextAppointment.id}`}>
              {formatDate(nextAppointment.start_at)}
            </a>
          ) : (
            '—'
          )}
        </p>
        <p>Faltas: {noShowCount}</p>
        <p>Cancelamentos: {cancelledCount}</p>
        <p>Total gasto: {formatEuros(totalSpentCents)}</p>
        <p>
          Última forma de pagamento:{' '}
          {lastPaymentMethod ? PAYMENT_METHOD_LABELS[lastPaymentMethod] : '—'}
        </p>
      </Card>

      <Card>
        <p className="text-eyebrow">Preferências</p>
        <ClientPreferencesForm clientId={client.id} preferences={preferences} />
      </Card>

      <Card>
        <p className="text-eyebrow">Observações privadas</p>
        <ClientPrivateNotesForm clientId={client.id} privateNotes={client.private_notes ?? ''} />
      </Card>

      <Card>
        <p className="text-eyebrow">Histórico</p>
        {allAppointments.length === 0 ? (
          <p className="text-support">Sem marcações ainda.</p>
        ) : (
          <ul className="appointment-card-list">
            {allAppointments.map((appointment) => (
              <li
                key={appointment.id}
                className={`appointment-card appointment-card-${appointment.status}`}
              >
                <div className="appointment-card-header">
                  <span className="appointment-card-time">{formatDate(appointment.start_at)}</span>
                  <span className="appointment-card-status">{appointment.status}</span>
                </div>
                {(appointment.appointment_items ?? []).length > 0 ? (
                  <p className="appointment-card-items">
                    {(appointment.appointment_items ?? [])
                      .map((item) => item.description)
                      .join(', ')}
                  </p>
                ) : null}
                <p className="appointment-card-total">
                  {formatEuros(appointment.final_total_cents ?? appointment.expected_total_cents)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
