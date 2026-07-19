import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { NoShowPolicyForm } from '@/features/settings/NoShowPolicyForm';

// NEX-095: the rest of this page (EPIC-14, "Central de definições em cartões") is not
// built yet — this only adds the no-show policy card asked for by this task, without
// expanding into the full settings hub.
export default async function DefinicoesPage() {
  const { tenantId } = await requireProfile();
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('business_settings')
    .select('no_show_limit, no_show_window_days')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return (
    <div className="shell">
      <p className="eyebrow">Definições</p>
      <h1>Definições</h1>
      <Card>
        <p>Esta área fica disponível numa próxima atualização.</p>
      </Card>
      <Card>
        <p className="public-step-label">Política de faltas</p>
        <NoShowPolicyForm
          noShowLimit={settings?.no_show_limit ?? null}
          noShowWindowDays={settings?.no_show_window_days ?? 90}
        />
      </Card>
    </div>
  );
}
