'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import { nextStep, previousStep } from '@/features/onboarding/domain/wizard';
import { businessStepSchema } from '@/features/onboarding/domain/business-step';
import { hoursStepSchema, parseHoursFormData } from '@/features/onboarding/domain/hours-step';
import { serviceItemSchema } from '@/features/onboarding/domain/services-step';
import { rulesStepSchema } from '@/features/onboarding/domain/rules-step';
import { normalizeSlug, publishStepSchema } from '@/features/onboarding/domain/publish-step';
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

export async function submitPublishStep(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = publishStepSchema.safeParse({
    slug: normalizeSlug(String(formData.get('slug') ?? '')),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Verifique o link introduzido.',
      },
    };
  }

  await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc('publish_business', { p_slug: parsed.data.slug });

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Este link já está a ser usado. Escolha outro.',
        },
      };
    }
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível publicar. Tente novamente.' },
    };
  }

  revalidatePath('/onboarding');
  redirect('/dashboard');
}

export async function addService(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = serviceItemSchema.safeParse({
    name: formData.get('name'),
    priceEuros: formData.get('priceEuros'),
    durationMinutes: formData.get('durationMinutes'),
    categoryName: formData.get('categoryName'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Verifique os dados do serviço.',
      },
    };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data: existingCategory } = await supabase
    .from('service_categories')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', parsed.data.categoryName)
    .maybeSingle();

  let categoryId: string | undefined = existingCategory?.id;
  if (!categoryId) {
    const { data: created, error: createError } = await supabase
      .from('service_categories')
      .insert({ tenant_id: tenantId, name: parsed.data.categoryName })
      .select('id')
      .single();

    if (createError) {
      if (createError.code === '23505') {
        // Race with a concurrent submit that created the same category first.
        const { data: retry } = await supabase
          .from('service_categories')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('name', parsed.data.categoryName)
          .single();
        categoryId = retry?.id;
      } else {
        return {
          ok: false,
          error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
        };
      }
    } else {
      categoryId = created.id;
    }
  }

  if (!categoryId) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }

  const { error: insertError } = await supabase.from('services').insert({
    tenant_id: tenantId,
    category_id: categoryId,
    name: parsed.data.name,
    price_cents: parsed.data.priceEuros,
    duration_minutes: parsed.data.durationMinutes,
  });

  if (insertError) {
    if (insertError.code === '23505') {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Já existe um serviço chamado "${parsed.data.name}".`,
        },
      };
    }
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }

  revalidatePath('/onboarding');
  return { ok: true, value: null };
}

export async function advanceServicesStep(
  _prevState: Result<null> | null,
  _formData: FormData,
): Promise<Result<null>> {
  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { count } = await supabase
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  if (!count || count < 1) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Adicione pelo menos um serviço antes de continuar.',
      },
    };
  }

  await moveStep('next');
  return { ok: true, value: null };
}

export async function submitHoursStep(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = hoursStepSchema.safeParse({ days: parseHoursFormData(formData) });

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Verifique os horários introduzidos.',
      },
    };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const rows = parsed.data.days.map((day) => ({
    tenant_id: tenantId,
    day_of_week: day.dayOfWeek,
    is_open: day.isOpen,
    opens_at: day.isOpen ? day.opensAt : null,
    closes_at: day.isOpen ? day.closesAt : null,
    lunch_starts_at: day.isOpen && day.lunchStartsAt ? day.lunchStartsAt : null,
    lunch_ends_at: day.isOpen && day.lunchEndsAt ? day.lunchEndsAt : null,
  }));

  const { error: upsertError } = await supabase
    .from('business_hours')
    .upsert(rows, { onConflict: 'tenant_id,day_of_week' });
  if (upsertError) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }

  const { data: settings } = await supabase
    .from('business_settings')
    .select('onboarding_step')
    .eq('tenant_id', tenantId)
    .single();
  if (settings) {
    await supabase
      .from('business_settings')
      .update({ onboarding_step: nextStep(settings.onboarding_step) })
      .eq('tenant_id', tenantId);
  }

  revalidatePath('/onboarding');
  return { ok: true, value: null };
}

export async function submitRulesStep(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = rulesStepSchema.safeParse({
    slotIntervalMinutes: formData.get('slotIntervalMinutes'),
    bufferMinutes: formData.get('bufferMinutes'),
    minNoticeHours: formData.get('minNoticeHours'),
    bookingWindowDays: formData.get('bookingWindowDays'),
    cancellationNoticeHours: formData.get('cancellationNoticeHours'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Verifique as regras selecionadas.',
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
      slot_interval_minutes: parsed.data.slotIntervalMinutes,
      buffer_minutes: parsed.data.bufferMinutes,
      min_notice_hours: parsed.data.minNoticeHours,
      booking_window_days: parsed.data.bookingWindowDays,
      cancellation_notice_hours: parsed.data.cancellationNoticeHours,
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
