import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { goToNextStep, goToPreviousStep } from '@/features/onboarding/actions';
import { STEP_TITLES, TOTAL_STEPS } from '@/features/onboarding/domain/wizard';

export default async function OnboardingPage() {
  const { tenantId } = await requireProfile();
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from('business_settings')
    .select('onboarding_step')
    .eq('tenant_id', tenantId)
    .single();

  const step = settings?.onboarding_step ?? 1;
  const title = STEP_TITLES[step - 1];

  return (
    <main className="shell centered">
      <Card className="auth-card">
        <p className="eyebrow">
          Passo {step} de {TOTAL_STEPS}
        </p>
        <h1>{title}</h1>
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
      </Card>
    </main>
  );
}
