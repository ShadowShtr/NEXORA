import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { NoShowPolicyForm } from '@/features/settings/NoShowPolicyForm';
import { ReminderTemplateForm } from '@/features/reminders/ReminderTemplateForm';

// NEX-095/NEX-104: the rest of this page (EPIC-14, "Central de definições em cartões")
// is not built yet — this only adds the cards asked for by those two tasks, without
// expanding into the full settings hub.
export default async function DefinicoesPage() {
  const { tenantId } = await requireProfile();
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('business_settings')
    .select('no_show_limit, no_show_window_days, reminder_message_template')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return (
    <div className="shell">
      <p className="text-eyebrow">Definições</p>
      <h1 className="text-title">Definições</h1>
      <Card>
        <p className="text-support">Esta área fica disponível numa próxima atualização.</p>
      </Card>
      <Card>
        <p className="text-eyebrow">Política de faltas</p>
        <NoShowPolicyForm
          noShowLimit={settings?.no_show_limit ?? null}
          noShowWindowDays={settings?.no_show_window_days ?? 90}
        />
      </Card>
      <Card>
        <p className="text-eyebrow">Mensagem do lembrete</p>
        <ReminderTemplateForm template={settings?.reminder_message_template ?? null} />
      </Card>
    </div>
  );
}
