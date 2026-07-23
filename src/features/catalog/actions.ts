'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import {
  categoryIdSchema,
  createCategorySchema,
  findSwapTarget,
  moveCategorySchema,
  renameCategorySchema,
  type CategoryListItem,
} from '@/features/catalog/domain/category';
import {
  createServiceSchema,
  serviceIdSchema,
  updateServiceSchema,
} from '@/features/catalog/domain/service';
import {
  createPackageSchema,
  packageIdSchema,
  updatePackageSchema,
} from '@/features/catalog/domain/package';
import { hasAffectedRows } from '@/lib/write-confirmation';
import type { Result } from '@/lib/result';

const DUPLICATE_CATEGORY_NAME_MESSAGE = 'Já existe uma categoria com esse nome.';
const DUPLICATE_SERVICE_NAME_MESSAGE = 'Já existe um serviço com esse nome.';
const DUPLICATE_PACKAGE_NAME_MESSAGE = 'Já existe um pacote com esse nome.';
const PACKAGE_SAVE_ERROR_MESSAGE = 'Não foi possível guardar o pacote. Tente novamente.';

export async function createCategory(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = createCategorySchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Verifique o nome da categoria.',
      },
    };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('service_categories')
    .select('sort_order')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (existing?.sort_order ?? -1) + 1;

  const { error } = await supabase.from('service_categories').insert({
    tenant_id: tenantId,
    name: parsed.data.name,
    sort_order: nextSortOrder,
  });

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: DUPLICATE_CATEGORY_NAME_MESSAGE },
      };
    }
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }

  revalidatePath('/dashboard/servicos');
  return { ok: true, value: null };
}

export async function renameCategory(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = renameCategorySchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Verifique o nome da categoria.',
      },
    };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('service_categories')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)
    .select('id');

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: DUPLICATE_CATEGORY_NAME_MESSAGE },
      };
    }
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }
  if (!hasAffectedRows(data)) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Categoria não encontrada.' } };
  }

  revalidatePath('/dashboard/servicos');
  return { ok: true, value: null };
}

export async function toggleCategoryVisibility(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = categoryIdSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Categoria inválida.' } };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data: category } = await supabase
    .from('service_categories')
    .select('is_visible')
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!category) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Categoria não encontrada.' } };
  }

  const { data, error } = await supabase
    .from('service_categories')
    .update({ is_visible: !category.is_visible })
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)
    .select('id');

  if (error) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }
  if (!hasAffectedRows(data)) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Categoria não encontrada.' } };
  }

  revalidatePath('/dashboard/servicos');
  return { ok: true, value: null };
}

export async function moveCategory(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = moveCategorySchema.safeParse({
    id: formData.get('id'),
    direction: formData.get('direction'),
  });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Movimento inválido.' } };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from('service_categories')
    .select('id, name, sort_order, is_visible')
    .eq('tenant_id', tenantId);
  const categories: CategoryListItem[] = (rows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isVisible: row.is_visible,
  }));

  const swap = findSwapTarget(categories, parsed.data.id, parsed.data.direction);
  if (!swap) {
    // Already at that end of the list — nothing to do, not an error.
    return { ok: true, value: null };
  }

  const { data: firstData, error: firstError } = await supabase
    .from('service_categories')
    .update({ sort_order: swap.neighbour.sortOrder })
    .eq('id', swap.current.id)
    .eq('tenant_id', tenantId)
    .select('id');
  const { data: secondData, error: secondError } = await supabase
    .from('service_categories')
    .update({ sort_order: swap.current.sortOrder })
    .eq('id', swap.neighbour.id)
    .eq('tenant_id', tenantId)
    .select('id');

  if (firstError || secondError) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível reordenar. Tente novamente.' },
    };
  }
  if (!hasAffectedRows(firstData) || !hasAffectedRows(secondData)) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Categoria não encontrada.' } };
  }

  revalidatePath('/dashboard/servicos');
  return { ok: true, value: null };
}

export async function createService(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = createServiceSchema.safeParse({
    name: formData.get('name'),
    priceEuros: formData.get('priceEuros'),
    durationMinutes: formData.get('durationMinutes'),
    categoryId: formData.get('categoryId'),
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

  const { error } = await supabase.from('services').insert({
    tenant_id: tenantId,
    category_id: parsed.data.categoryId,
    name: parsed.data.name,
    price_cents: parsed.data.priceEuros,
    duration_minutes: parsed.data.durationMinutes,
  });

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: DUPLICATE_SERVICE_NAME_MESSAGE },
      };
    }
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }

  revalidatePath('/dashboard/servicos');
  return { ok: true, value: null };
}

export async function updateService(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = updateServiceSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    priceEuros: formData.get('priceEuros'),
    durationMinutes: formData.get('durationMinutes'),
    categoryId: formData.get('categoryId'),
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

  const { data, error } = await supabase
    .from('services')
    .update({
      name: parsed.data.name,
      price_cents: parsed.data.priceEuros,
      duration_minutes: parsed.data.durationMinutes,
      category_id: parsed.data.categoryId,
    })
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)
    .select('id');

  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: DUPLICATE_SERVICE_NAME_MESSAGE },
      };
    }
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }
  if (!hasAffectedRows(data)) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Serviço não encontrado.' } };
  }

  revalidatePath('/dashboard/servicos');
  return { ok: true, value: null };
}

export async function toggleServiceActive(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = serviceIdSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Serviço inválido.' } };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data: service } = await supabase
    .from('services')
    .select('is_active')
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!service) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Serviço não encontrado.' } };
  }

  const { data, error } = await supabase
    .from('services')
    .update({ is_active: !service.is_active })
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)
    .select('id');

  if (error) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }
  if (!hasAffectedRows(data)) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Serviço não encontrado.' } };
  }

  revalidatePath('/dashboard/servicos');
  return { ok: true, value: null };
}

export async function createPackage(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = createPackageSchema.safeParse({
    name: formData.get('name'),
    priceEuros: formData.get('priceEuros'),
    compareAtPriceEuros: formData.get('compareAtPriceEuros'),
    serviceIds: formData.getAll('serviceIds'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Verifique os dados do pacote.',
      },
    };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data: created, error: packageError } = await supabase
    .from('packages')
    .insert({
      tenant_id: tenantId,
      name: parsed.data.name,
      price_cents: parsed.data.priceEuros,
      compare_at_price_cents: parsed.data.compareAtPriceEuros,
    })
    .select('id')
    .single();

  if (packageError) {
    if (packageError.code === '23505') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: DUPLICATE_PACKAGE_NAME_MESSAGE },
      };
    }
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: PACKAGE_SAVE_ERROR_MESSAGE } };
  }

  const { error: itemsError } = await supabase.from('package_services').insert(
    parsed.data.serviceIds.map((serviceId) => ({
      tenant_id: tenantId,
      package_id: created.id,
      service_id: serviceId,
    })),
  );

  if (itemsError) {
    // Compensate: no transactions available over the JS client — remove the
    // package rather than leave an item-less pacote behind.
    await supabase.from('packages').delete().eq('id', created.id).eq('tenant_id', tenantId);
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: PACKAGE_SAVE_ERROR_MESSAGE } };
  }

  revalidatePath('/dashboard/servicos');
  return { ok: true, value: null };
}

export async function updatePackage(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = updatePackageSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    priceEuros: formData.get('priceEuros'),
    compareAtPriceEuros: formData.get('compareAtPriceEuros'),
    serviceIds: formData.getAll('serviceIds'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Verifique os dados do pacote.',
      },
    };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data: packageData, error: packageError } = await supabase
    .from('packages')
    .update({
      name: parsed.data.name,
      price_cents: parsed.data.priceEuros,
      compare_at_price_cents: parsed.data.compareAtPriceEuros,
    })
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)
    .select('id');

  if (packageError) {
    if (packageError.code === '23505') {
      return {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: DUPLICATE_PACKAGE_NAME_MESSAGE },
      };
    }
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: PACKAGE_SAVE_ERROR_MESSAGE } };
  }
  if (!hasAffectedRows(packageData)) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Pacote não encontrado.' } };
  }

  // Zero rows deleted here is not itself an error — a package can legitimately have
  // no existing package_services rows to clear (e.g. this being its first edit after
  // creation-time insert failed partway) — hasAffectedRows is intentionally not
  // checked on this delete, unlike the writes above that must land on a known row.
  const { error: deleteError } = await supabase
    .from('package_services')
    .delete()
    .eq('package_id', parsed.data.id)
    .eq('tenant_id', tenantId);
  if (deleteError) {
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: PACKAGE_SAVE_ERROR_MESSAGE } };
  }

  const { error: itemsError } = await supabase.from('package_services').insert(
    parsed.data.serviceIds.map((serviceId) => ({
      tenant_id: tenantId,
      package_id: parsed.data.id,
      service_id: serviceId,
    })),
  );
  if (itemsError) {
    return { ok: false, error: { code: 'INTERNAL_ERROR', message: PACKAGE_SAVE_ERROR_MESSAGE } };
  }

  revalidatePath('/dashboard/servicos');
  return { ok: true, value: null };
}

export async function togglePackageActive(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = packageIdSchema.safeParse({ id: formData.get('id') });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Pacote inválido.' } };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data: pkg } = await supabase
    .from('packages')
    .select('is_active')
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!pkg) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Pacote não encontrado.' } };
  }

  const { data, error } = await supabase
    .from('packages')
    .update({ is_active: !pkg.is_active })
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId)
    .select('id');

  if (error) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }
  if (!hasAffectedRows(data)) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Pacote não encontrado.' } };
  }

  revalidatePath('/dashboard/servicos');
  return { ok: true, value: null };
}
