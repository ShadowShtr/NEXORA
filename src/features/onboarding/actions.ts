'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import { nextStep, previousStep } from '@/features/onboarding/domain/wizard';
import { businessStepSchema } from '@/features/onboarding/domain/business-step';
import type { Result } from '@/lib/result';

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

export async function submitBusinessStep(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = businessStepSchema.safeParse({
    professionalName: formData.get('professionalName'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    addressLine: formData.get('addressLine'),
    postalCode: formData.get('postalCode'),
    locality: formData.get('locality'),
    mapsUrl: formData.get('mapsUrl'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Verifique os dados introduzidos.',
      },
    };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data: settings, error: readError } = await supabase
    .from('business_settings')
    .select('onboarding_step')
    .eq('tenant_id', tenantId)
    .single();
  if (readError || !settings) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }

  const { error: updateError } = await supabase
    .from('business_settings')
    .update({
      professional_name: parsed.data.professionalName,
      phone_e164: parsed.data.phone,
      email: parsed.data.email || null,
      address_line: parsed.data.addressLine,
      postal_code: parsed.data.postalCode,
      locality: parsed.data.locality,
      maps_url: parsed.data.mapsUrl || null,
      onboarding_step: nextStep(settings.onboarding_step),
    })
    .eq('tenant_id', tenantId);

  if (updateError) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }

  revalidatePath('/onboarding');
  return { ok: true, value: null };
}
