import Link from 'next/link';
import { formatInTimeZone } from 'date-fns-tz';
import { pt } from 'date-fns/locale/pt';
import { CheckCircle2, ChevronLeft, MessageCircle } from 'lucide-react';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { buildWhatsappDeepLink } from '@/features/appointments/domain/appointment-card';
import { buildPendingPaymentMessage } from '@/features/finance/domain/summary';
import { MarkPaidButtons } from '@/features/finance/MarkPaidButtons';

const PAGE_SIZE = 20;

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function pageHref(page: number) {
  return page > 1
    ? `/dashboard/financeiro/pendentes?page=${page}`
    : '/dashboard/financeiro/pendentes';
}

type PendingPayment = {
  id: string;
  amountCents: number;
  clientName: string;
  appointmentId: string | null;
  dateLabel: string;
  serviceDescriptions: string[];
  whatsappHref: string | null;
};

// NEX-114: "Área de pagamentos pendentes" — a real, dedicated list (not a period-scoped
// drill-down: pendências matter regardless of when they were incurred, same reasoning
// as lembretes/page.tsx listing every pending reminder tenant-wide). requireProfile()
// (dashboard layout) gates this page to an authenticated, provisioned owner and derives
// tenantId from their session; every query filters by it (RLS via createClient()
// enforces this too, as defense in depth).
async function loadPendingPayments(tenantId: string, page: number) {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('business_settings')
    .select('timezone')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const timezone = settings?.timezone ?? 'Europe/Lisbon';

  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await supabase
    .from('payments')
    .select(
      'id, amount_cents, appointments(id, start_at, clients(name, phone_e164), appointment_items(description))',
      { count: 'exact' },
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const payments: PendingPayment[] = (data ?? []).map((row) => {
    const appointment = Array.isArray(row.appointments) ? row.appointments[0] : row.appointments;
    const client = appointment
      ? Array.isArray(appointment.clients)
        ? appointment.clients[0]
        : appointment.clients
      : null;
    const clientName = client?.name ?? 'Cliente';
    return {
      id: row.id,
      amountCents: row.amount_cents,
      clientName,
      appointmentId: appointment?.id ?? null,
      dateLabel: appointment
        ? formatInTimeZone(appointment.start_at, timezone, "dd/MM/yyyy 'às' HH:mm", { locale: pt })
        : '—',
      serviceDescriptions: (appointment?.appointment_items ?? []).map((item) => item.description),
      whatsappHref: client?.phone_e164
        ? buildWhatsappDeepLink(
            client.phone_e164,
            buildPendingPaymentMessage(clientName, formatEuros(row.amount_cents)),
          )
        : null,
    };
  });

  return { payments, total: count ?? 0 };
}

export default async function PendingPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { tenantId } = await requireProfile();
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);

  const { payments, total } = await loadPendingPayments(tenantId, page);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="shell finance-page">
      <div className="finance-title-row">
        <Link
          href="/dashboard/financeiro"
          className="finance-back-button"
          aria-label="Voltar a Financeiro"
        >
          <ChevronLeft aria-hidden="true" size={20} />
        </Link>
        <h1 className="more-title">Pagamentos pendentes</h1>
      </div>

      {payments.length === 0 ? (
        <div className="pending-empty-state">
          <CheckCircle2 aria-hidden="true" size={20} />
          Tudo regularizado
        </div>
      ) : (
        <>
          <ul className="pending-payment-list">
            {payments.map((payment) => (
              <li key={payment.id} className="pending-payment-item">
                {payment.appointmentId ? (
                  <Link
                    href={`/dashboard/agenda/${payment.appointmentId}`}
                    className="pending-payment-info"
                  >
                    <span className="pending-payment-client">{payment.clientName}</span>
                    <span className="pending-payment-meta">
                      {payment.dateLabel}
                      {payment.serviceDescriptions.length > 0
                        ? ` · ${payment.serviceDescriptions.join(', ')}`
                        : ''}
                    </span>
                  </Link>
                ) : (
                  <div className="pending-payment-info">
                    <span className="pending-payment-client">{payment.clientName}</span>
                    <span className="pending-payment-meta">{payment.dateLabel}</span>
                  </div>
                )}
                <span className="pending-payment-value">{formatEuros(payment.amountCents)}</span>
                {payment.whatsappHref ? (
                  <a
                    className="reminder-whatsapp-button pending-payment-whatsapp"
                    href={payment.whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Abrir WhatsApp com ${payment.clientName}`}
                  >
                    <MessageCircle aria-hidden="true" size={17} />
                  </a>
                ) : null}
                <MarkPaidButtons paymentId={payment.id} />
              </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <nav className="agenda-date-nav" aria-label="Paginação de pagamentos pendentes">
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
