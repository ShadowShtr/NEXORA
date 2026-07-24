import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { NoShowPolicyForm } from '@/features/settings/NoShowPolicyForm';

// NEX-140: relocates the "Política de faltas" (NEX-095) card from the old flat
// definições page into its own category, unchanged otherwise.
export default async function MarcacoesSettingsPage() {
  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from('business_settings')
    .select('no_show_limit, no_show_window_days')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return (
    <div className="shell">
      <div className="finance-title-row">
        <Link
          href="/dashboard/definicoes"
          className="finance-back-button"
          aria-label="Voltar a Definições"
        >
          <ChevronLeft aria-hidden="true" size={20} />
        </Link>
        <h1 className="more-title">Marcações</h1>
      </div>
      <Card>
        <p className="text-eyebrow">Política de faltas</p>
        <NoShowPolicyForm
          noShowLimit={settings?.no_show_limit ?? null}
          noShowWindowDays={settings?.no_show_window_days ?? 90}
        />
      </Card>
    </div>
  );
}
