import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { STEP_TITLES, TOTAL_STEPS } from '@/features/onboarding/domain/wizard';
import { BusinessStep } from '@/features/onboarding/BusinessStep';
import { HoursStep } from '@/features/onboarding/HoursStep';
import { DEFAULT_HOURS, mergeHoursWithDefaults } from '@/features/onboarding/domain/hours-step';
import { ServicesStep } from '@/features/onboarding/ServicesStep';
import type { ServiceListItem } from '@/features/onboarding/domain/services-step';
import { RulesStep } from '@/features/onboarding/RulesStep';
import { RECOMMENDED_RULES } from '@/features/onboarding/domain/rules-step';
import { PublishStep } from '@/features/onboarding/PublishStep';

export default async function OnboardingPage() {
  const { tenantId } = await requireProfile();
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('business_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  const step = settings?.onboarding_step ?? 1;
  const title = STEP_TITLES[step - 1];

  let hoursDays = DEFAULT_HOURS;
  if (step === 2) {
    const { data: hoursRows } = await supabase
      .from('business_hours')
      .select('day_of_week, is_open, opens_at, closes_at, lunch_starts_at, lunch_ends_at')
      .eq('tenant_id', tenantId);
    hoursDays = mergeHoursWithDefaults(hoursRows ?? []);
  }

  let tenantSlug = '';
  if (step === 5) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', tenantId)
      .single();
    tenantSlug = tenant?.slug ?? '';
  }

  let services: ServiceListItem[] = [];
  if (step === 3) {
    const [{ data: servicesRows }, { data: categoriesRows }] = await Promise.all([
      supabase
        .from('services')
        .select('id, name, price_cents, duration_minutes, category_id')
        .eq('tenant_id', tenantId)
        .order('created_at'),
      supabase.from('service_categories').select('id, name').eq('tenant_id', tenantId),
    ]);
    const categoryNameById = new Map(
      (categoriesRows ?? []).map((category) => [category.id, category.name]),
    );
    services = (servicesRows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      priceCents: row.price_cents,
      durationMinutes: row.duration_minutes,
      categoryName: categoryNameById.get(row.category_id) ?? '',
    }));
  }

  return (
    <main className="shell centered">
      <Card className="wizard-card">
        <p className="text-eyebrow">
          Passo {step} de {TOTAL_STEPS}
        </p>
        <h1 className="text-title">{title}</h1>
        {step === 1 ? (
          <BusinessStep
            initialValues={{
              professionalName: settings?.professional_name ?? '',
              phone: settings?.phone_e164 ?? '',
              email: settings?.email ?? '',
              addressLine: settings?.address_line ?? '',
              postalCode: settings?.postal_code ?? '',
              locality: settings?.locality ?? '',
              mapsUrl: settings?.maps_url ?? '',
            }}
          />
        ) : step === 2 ? (
          <HoursStep initialDays={hoursDays} />
        ) : step === 3 ? (
          <ServicesStep services={services} />
        ) : step === 4 ? (
          <RulesStep
            initialValues={{
              slotIntervalMinutes:
                settings?.slot_interval_minutes ?? RECOMMENDED_RULES.slotIntervalMinutes,
              bufferMinutes: settings?.buffer_minutes ?? RECOMMENDED_RULES.bufferMinutes,
              minNoticeHours: settings?.min_notice_hours ?? RECOMMENDED_RULES.minNoticeHours,
              bookingWindowDays:
                settings?.booking_window_days ?? RECOMMENDED_RULES.bookingWindowDays,
              cancellationNoticeHours:
                settings?.cancellation_notice_hours ?? RECOMMENDED_RULES.cancellationNoticeHours,
            }}
          />
        ) : (
          <PublishStep initialSlug={tenantSlug} appUrl={publicEnv.NEXT_PUBLIC_APP_URL} />
        )}
      </Card>
    </main>
  );
}
