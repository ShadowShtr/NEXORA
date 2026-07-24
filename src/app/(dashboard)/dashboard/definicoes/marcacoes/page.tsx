import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { NoShowPolicyForm } from '@/features/settings/NoShowPolicyForm';
import { BookingRulesForm } from '@/features/settings/BookingRulesForm';

// NEX-140: relocates the "Política de faltas" (NEX-095) card from the old flat
// definições page into its own category, unchanged otherwise.
// NEX-141: adds "Regras da agenda" — the same 5 rules from onboarding's RulesStep
// (NEX-034), editable here for the first time.
export default async function MarcacoesSettingsPage() {
  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from('business_settings')
    .select(
      'no_show_limit, no_show_window_days, slot_interval_minutes, buffer_minutes, min_notice_hours, booking_window_days, cancellation_notice_hours',
    )
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
        <p className="text-eyebrow">Regras da agenda</p>
        <BookingRulesForm
          initialValues={{
            slotIntervalMinutes: settings?.slot_interval_minutes ?? 30,
            bufferMinutes: settings?.buffer_minutes ?? 15,
            minNoticeHours: settings?.min_notice_hours ?? 3,
            bookingWindowDays: settings?.booking_window_days ?? 60,
            cancellationNoticeHours: settings?.cancellation_notice_hours ?? 24,
          }}
        />
      </Card>
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
