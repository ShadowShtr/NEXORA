'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import { nextStep, previousStep } from '@/features/onboarding/domain/wizard';

async function moveStep(direction: 'next' | 'previous') {
  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data: settings, error: readError } = await supabase
    .from('business_settings')
    .select('onboarding_step')
    .eq('tenant_id', tenantId)
    .single();
  if (readError || !settings) return;

  const updated =
    direction === 'next'
      ? nextStep(settings.onboarding_step)
      : previousStep(settings.onboarding_step);

  await supabase
    .from('business_settings')
    .update({ onboarding_step: updated })
    .eq('tenant_id', tenantId);

  revalidatePath('/onboarding');
}

export async function goToNextStep() {
  await moveStep('next');
}

export async function goToPreviousStep() {
  await moveStep('previous');
}
