import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { ReminderTemplateForm } from '@/features/reminders/ReminderTemplateForm';

// NEX-140: relocates the "Mensagem do lembrete" (NEX-104) card from the old flat
// definições page into its own category, unchanged otherwise.
export default async function LembretesSettingsPage() {
  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from('business_settings')
    .select('reminder_message_template')
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
        <h1 className="more-title">Lembretes</h1>
      </div>
      <Card>
        <p className="text-eyebrow">Mensagem do lembrete</p>
        <ReminderTemplateForm template={settings?.reminder_message_template ?? null} />
      </Card>
    </div>
  );
}
