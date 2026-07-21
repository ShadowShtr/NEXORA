import Link from 'next/link';
import { Bell, Search, UserPlus } from 'lucide-react';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { ClientCard, type ClientCardData } from '@/features/clients/ClientCard';
import { ClientsFab } from '@/features/clients/ClientsFab';

const PAGE_SIZE = 20;
const ACTIVE_WINDOW_DAYS = 90;
const NEW_WINDOW_DAYS = 30;

type ClientFilter = 'all' | 'active' | 'new';

function isClientFilter(value: string | undefined): value is ClientFilter {
  return value === 'all' || value === 'active' || value === 'new';
}

function escapeIlikePattern(value: string): string {
  // PostgREST's or()/ilike syntax treats ",", ")" and "%"/"_" specially — a raw search
  // term containing any of them would otherwise break out of the filter expression or
  // be misinterpreted as a wildcard. Escaping keeps the search literal.
  return value.replace(/[%_,()]/g, (char) => `\\${char}`);
}

function pageHref(query: string, filter: ClientFilter, page: number) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (filter !== 'all') params.set('filter', filter);
  if (page > 1) params.set('page', String(page));
  const queryString = params.toString();
  return `/dashboard/clientes${queryString ? `?${queryString}` : ''}`;
}

// Data loading (including the Date.now() read) lives outside the component body — see
// the same purity-rule note in src/app/(dashboard)/dashboard/page.tsx (NEX-080).
async function loadClientsData(
  tenantId: string,
  query: string,
  filter: ClientFilter,
  page: number,
) {
  const supabase = await createClient();
  const nowMs = Date.now();

  const [{ data: settings }, { count: pendingRemindersCount }] = await Promise.all([
    supabase.from('business_settings').select('timezone').eq('tenant_id', tenantId).maybeSingle(),
    supabase
      .from('reminders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending'),
  ]);
  const timezone = settings?.timezone ?? 'Europe/Lisbon';

  const activeSinceIso = new Date(nowMs - ACTIVE_WINDOW_DAYS * 24 * 60 * 60_000).toISOString();
  const newSinceIso = new Date(nowMs - NEW_WINDOW_DAYS * 24 * 60 * 60_000).toISOString();

  // "Ativa" has no dedicated column — it's derived from real appointment activity, not
  // fabricated. Computed as a plain client_id list (deduped in JS) rather than an
  // embedded inner-join filter on the main query below, which would otherwise return one
  // duplicate client row per matching appointment.
  const [{ count: totalCount }, { count: newCount }, { data: activeApptRows }] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('first_seen_at', newSinceIso),
    supabase
      .from('appointments')
      .select('client_id')
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelled')
      .gte('start_at', activeSinceIso),
  ]);
  const activeClientIds = [...new Set((activeApptRows ?? []).map((row) => row.client_id))];

  let request = supabase
    .from('clients')
    .select('id, name, phone_e164', { count: 'exact' })
    .eq('tenant_id', tenantId);

  if (query) {
    const pattern = `%${escapeIlikePattern(query)}%`;
    request = request.or(`name.ilike.${pattern},phone_e164.ilike.${pattern}`);
  }
  if (filter === 'new') {
    request = request.gte('first_seen_at', newSinceIso);
  } else if (filter === 'active') {
    request = request.in('id', activeClientIds.length > 0 ? activeClientIds : ['—']);
  }

  const from = (page - 1) * PAGE_SIZE;
  const { data: clientRows, count } = await request.order('name').range(from, from + PAGE_SIZE - 1);
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageClientIds = (clientRows ?? []).map((row) => row.id);
  const statsByClientId = new Map<string, { lastCompletedMs: number | null; spentCents: number }>();
  for (const id of pageClientIds) statsByClientId.set(id, { lastCompletedMs: null, spentCents: 0 });

  if (pageClientIds.length > 0) {
    const { data: apptRows } = await supabase
      .from('appointments')
      .select('id, client_id, start_at, status')
      .eq('tenant_id', tenantId)
      .in('client_id', pageClientIds);

    for (const appt of apptRows ?? []) {
      if (appt.status !== 'completed') continue;
      const startMs = new Date(appt.start_at).getTime();
      const stats = statsByClientId.get(appt.client_id);
      if (stats && (stats.lastCompletedMs === null || startMs > stats.lastCompletedMs)) {
        stats.lastCompletedMs = startMs;
      }
    }

    const apptIdToClientId = new Map((apptRows ?? []).map((row) => [row.id, row.client_id]));
    const apptIds = (apptRows ?? []).map((row) => row.id);
    if (apptIds.length > 0) {
      const { data: paymentRows } = await supabase
        .from('payments')
        .select('appointment_id, amount_cents')
        .eq('tenant_id', tenantId)
        .eq('status', 'paid')
        .in('appointment_id', apptIds);

      for (const payment of paymentRows ?? []) {
        const clientId = apptIdToClientId.get(payment.appointment_id);
        const stats = clientId ? statsByClientId.get(clientId) : undefined;
        if (stats) stats.spentCents += payment.amount_cents;
      }
    }
  }

  const clients: ClientCardData[] = (clientRows ?? []).map((row) => {
    const stats = statsByClientId.get(row.id);
    return {
      id: row.id,
      name: row.name,
      phoneE164: row.phone_e164,
      lastAppointmentMs: stats?.lastCompletedMs ?? null,
      totalSpentCents: stats?.spentCents ?? 0,
    };
  });

  return {
    clients,
    total,
    totalPages,
    timezone,
    pendingRemindersCount: pendingRemindersCount ?? 0,
    chipCounts: { all: totalCount ?? 0, active: activeClientIds.length, new: newCount ?? 0 },
  };
}

// NEX-090: "Busca por nome/telefone, paginação e empty state" (docs/01_PRODUCT_REQUIREMENTS.md
// §10). requireProfile() (dashboard layout) gates this page to an authenticated,
// provisioned owner and derives tenantId from their session — every query filters by
// it (RLS via createClient() enforces this too, as defense in depth).
//
// Visual refinement mid-2026: reference asked for an avatar photo per client, a
// standalone "criar cliente" flow behind both a top-bar "+" and the floating "+", and a
// generic "filtro" button alongside the Todos/Ativos/Novos chips. None of those are
// real here — this schema has no client profile-photo field (client_photos are
// before/after service photos, a different concept), and there is no dedicated
// client-creation form anywhere in the app; clients are only ever created inline
// through create_manual_booking (the agenda's "nova marcação" flow, same one the
// dashboard's own shortcut already points to). So: avatars are initials-on-soft-
// background (the reference's own documented fallback), the floating "+" is the one
// "add" affordance and it opens nova marcação, and there is no second decorative
// filter button — Todos/Ativos/Novos already are the filter, and duplicating that
// under an unrelated icon would be a dead control.
export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; filter?: string }>;
}) {
  const { tenantId } = await requireProfile();
  const params = await searchParams;
  const query = (params.q ?? '').trim();
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const filter = isClientFilter(params.filter) ? params.filter : 'all';

  const { clients, totalPages, timezone, pendingRemindersCount, chipCounts } =
    await loadClientsData(tenantId, query, filter, page);

  const isSearching = query.length > 0;
  const isEmptyTenant = chipCounts.all === 0;

  return (
    <div className="shell clients-page">
      <header className="clients-header-top">
        <span className="clients-logo">NEXORA</span>
        <Link
          href="/dashboard/lembretes"
          className="notification-button"
          aria-label={
            pendingRemindersCount > 0
              ? `Lembretes (${pendingRemindersCount} pendentes)`
              : 'Lembretes'
          }
        >
          <Bell aria-hidden="true" size={20} />
          {pendingRemindersCount > 0 ? (
            <span className="notification-badge" aria-hidden="true">
              {pendingRemindersCount > 99 ? '99+' : pendingRemindersCount}
            </span>
          ) : null}
        </Link>
      </header>

      <h1 className="clients-title">Clientes</h1>

      <form className="clients-search-row" method="get">
        <span className="search-input-wrapper">
          <Search aria-hidden="true" />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Pesquisar por nome ou telemóvel"
            className="clients-search-input"
            aria-label="Pesquisar cliente"
          />
        </span>
        {filter !== 'all' ? <input type="hidden" name="filter" value={filter} /> : null}
      </form>

      <div className="clients-filter-chips">
        <a
          href={pageHref(query, 'all', 1)}
          className="filter-chip"
          data-active={filter === 'all' || undefined}
        >
          Todos <span className="filter-chip-count">{chipCounts.all}</span>
        </a>
        <a
          href={pageHref(query, 'active', 1)}
          className="filter-chip"
          data-active={filter === 'active' || undefined}
        >
          Ativos <span className="filter-chip-count">{chipCounts.active}</span>
        </a>
        <a
          href={pageHref(query, 'new', 1)}
          className="filter-chip"
          data-active={filter === 'new' || undefined}
        >
          Novos <span className="filter-chip-count">{chipCounts.new}</span>
        </a>
      </div>

      {clients.length === 0 ? (
        <div className="clients-empty-state">
          {isEmptyTenant ? (
            <>
              <p className="text-support">Ainda não existem clientes registadas.</p>
              <Link href="/dashboard/agenda/nova" className="button link-button">
                <UserPlus aria-hidden="true" size={18} />
                Adicionar primeira cliente
              </Link>
            </>
          ) : isSearching ? (
            <>
              <p className="text-support">Nenhuma cliente encontrada para esta pesquisa.</p>
              <a href={pageHref('', filter, 1)} className="button button-secondary">
                Limpar pesquisa
              </a>
            </>
          ) : (
            <p className="text-support">Sem clientes neste filtro.</p>
          )}
        </div>
      ) : (
        <>
          <ul className="client-cards-list">
            {clients.map((client, index) => (
              <ClientCard
                key={client.id}
                client={client}
                timezone={timezone}
                style={{ animationDelay: `${index * 35}ms` }}
              />
            ))}
            <div id="clients-list-end" aria-hidden="true" />
          </ul>

          {totalPages > 1 ? (
            <nav className="agenda-date-nav" aria-label="Paginação de clientes">
              {page > 1 ? (
                <a href={pageHref(query, filter, page - 1)} className="button-secondary button">
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
                <a href={pageHref(query, filter, page + 1)} className="button-secondary button">
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

      <ClientsFab />
    </div>
  );
}
