import { Bell, BarChart3, Settings, Wallet } from 'lucide-react';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { publicBookingUrl } from '@/features/onboarding/domain/publish-step';
import { ProfileSummaryCard } from '@/features/shell/ProfileSummaryCard';
import { MoreMenuItem, MoreSection } from '@/features/shell/MoreMenuItem';
import { LogoutSection } from '@/features/shell/LogoutSection';
import { InstallAppCard } from '@/features/shell/InstallAppCard';

const APP_VERSION = '0.1.0';

// PR3: used to also fetch `profiles.display_name` and `tenants.slug` itself, two
// redundant queries — both already resolved by the caller's memoized auth context
// (requireProfile(), shares getAuthContext() with the dashboard layout in the same
// request). See docs/audits/NEXORA_PERFORMANCE_AUDIT.md (PR3 update, "duplicações
// removidas").
async function loadMoreData(tenantId: string) {
  const supabase = await createClient();

  const [{ count: pendingRemindersCount }, { count: pendingPaymentsCount }] = await Promise.all([
    supabase
      .from('reminders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending'),
    supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'pending'),
  ]);

  return {
    pendingRemindersCount: pendingRemindersCount ?? 0,
    pendingPaymentsCount: pendingPaymentsCount ?? 0,
  };
}

// Visual refinement mid-2026 — "Mais" reference: a real page (/dashboard/mais), not an
// overlay panel over whatever page was open before — AppShell.tsx's mobile "Mais" nav
// item now just links here like any other tab, so it correctly shows as the active
// bottom-nav item and the previous page's floating "+" is gone simply because this page
// never renders one (every FAB is page-scoped: AgendaFab/ClientsFab/ServicesFab).
//
// This screen still keeps a single "Definições" row (not the reference's four-way
// split) — /dashboard/definicoes is itself now a category hub (NEX-140: Negócio,
// Agenda, Marcações, Lembretes, Pagamentos, Aparência, Dados), so the split the
// reference asked for lives one level down instead of duplicated here. Keeps the exact
// four destinations the old overlay menu already had (Lembretes/Financeiro/
// Relatórios/Definições). Also drops the reference's "Suporte" section entirely — no
// help center, feedback form, or support contact exists anywhere in this app to link
// to.
export default async function MaisPage() {
  const { tenantId, displayName, tenantSlug } = await requireProfile();
  const { pendingRemindersCount, pendingPaymentsCount } = await loadMoreData(tenantId);

  const publicUrl = tenantSlug ? publicBookingUrl(publicEnv.NEXT_PUBLIC_APP_URL, tenantSlug) : null;

  return (
    <div className="shell more-page">
      <header className="more-top-header">
        <span className="more-logo">NEXORA</span>
        <a
          href="/dashboard/lembretes"
          className="more-notification-button"
          aria-label={
            pendingRemindersCount > 0
              ? `Lembretes (${pendingRemindersCount} pendentes)`
              : 'Lembretes'
          }
        >
          <Bell aria-hidden="true" size={20} />
        </a>
      </header>

      <h1 className="more-title">Mais</h1>

      <ProfileSummaryCard displayName={displayName} publicUrl={publicUrl} />

      <MoreSection title="Gestão">
        <MoreMenuItem
          href="/dashboard/lembretes"
          icon={Bell}
          label="Lembretes"
          description="Mensagens que precisam ser enviadas"
          badge={pendingRemindersCount}
        />
        <MoreMenuItem
          href="/dashboard/financeiro"
          icon={Wallet}
          label="Financeiro"
          description="Receitas, pagamentos e pendências"
          badge={pendingPaymentsCount}
        />
        <MoreMenuItem
          href="/dashboard/relatorios"
          icon={BarChart3}
          label="Relatórios"
          description="Resultados por período"
        />
        <MoreMenuItem
          href="/dashboard/definicoes"
          icon={Settings}
          label="Definições"
          description="Regras de marcação, lembretes e o seu negócio"
        />
      </MoreSection>

      <InstallAppCard />

      <LogoutSection />

      <p className="app-version">NEXORA {APP_VERSION}</p>
    </div>
  );
}
