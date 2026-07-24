import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { AvailabilityBlocksManager } from '@/features/settings/AvailabilityBlocksManager';
import { BusinessHoursExceptionsManager } from '@/features/settings/BusinessHoursExceptionsManager';

// NEX-140: relocates the "Bloqueios de agenda" (NEX-124) and "Horários especiais"
// (NEX-125) cards from the old flat definições page into their own category, unchanged
// otherwise.
export default async function AgendaSettingsPage() {
  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const [{ data: settings }, { data: blockRows }, { data: exceptionRows }] = await Promise.all([
    supabase.from('business_settings').select('timezone').eq('tenant_id', tenantId).maybeSingle(),
    supabase
      .from('availability_blocks')
      .select('id, starts_at, ends_at, reason, is_all_day')
      .eq('tenant_id', tenantId)
      .gt('ends_at', new Date().toISOString())
      .order('starts_at'),
    supabase
      .from('business_hours_exceptions')
      .select('id, exception_date, is_open, opens_at, closes_at')
      .eq('tenant_id', tenantId)
      .gte('exception_date', new Date().toISOString().slice(0, 10))
      .order('exception_date'),
  ]);

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
        <h1 className="more-title">Agenda</h1>
      </div>
      <Card>
        <p className="text-eyebrow">Bloqueios de agenda</p>
        <AvailabilityBlocksManager
          blocks={(blockRows ?? []).map((block) => ({
            id: block.id,
            startsAt: block.starts_at,
            endsAt: block.ends_at,
            reason: block.reason,
            isAllDay: block.is_all_day,
          }))}
          timezone={settings?.timezone ?? 'Europe/Lisbon'}
        />
      </Card>
      <Card>
        <p className="text-eyebrow">Horários especiais</p>
        <BusinessHoursExceptionsManager
          exceptions={(exceptionRows ?? []).map((exception) => ({
            id: exception.id,
            exceptionDate: exception.exception_date,
            isOpen: exception.is_open,
            opensAt: exception.opens_at,
            closesAt: exception.closes_at,
          }))}
        />
      </Card>
    </div>
  );
}
