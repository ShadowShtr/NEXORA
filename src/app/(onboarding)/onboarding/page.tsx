import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { goToNextStep, goToPreviousStep } from '@/features/onboarding/actions';
import { STEP_TITLES, TOTAL_STEPS } from '@/features/onboarding/domain/wizard';
import { BusinessStep } from '@/features/onboarding/BusinessStep';
import { HoursStep } from '@/features/onboarding/HoursStep';
import { DEFAULT_HOURS, mergeHoursWithDefaults } from '@/features/onboarding/domain/hours-step';
import { ServicesStep } from '@/features/onboarding/ServicesStep';
import type { ServiceListItem } from '@/features/onboarding/domain/services-step';

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
        <p className="eyebrow">
          Passo {step} de {TOTAL_STEPS}
        </p>
        <h1>{title}</h1>
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
        ) : (
          <>
            <p>Esta etapa fica disponível numa próxima atualização.</p>
            <div className="wizard-actions">
              {step > 1 ? (
                <form action={goToPreviousStep}>
                  <Button type="submit">Voltar</Button>
                </form>
              ) : (
                <span />
              )}
              {step < TOTAL_STEPS ? (
                <form action={goToNextStep}>
                  <Button type="submit">Seguinte</Button>
                </form>
              ) : null}
            </div>
          </>
        )}
      </Card>
    </main>
  );
}
