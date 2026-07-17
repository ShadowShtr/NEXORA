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
import type { Result } from '@/lib/result';

const DUPLICATE_NAME_MESSAGE = 'Já existe uma categoria com esse nome.';

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
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: DUPLICATE_NAME_MESSAGE } };
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

  const { error } = await supabase
    .from('service_categories')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId);

  if (error) {
    if (error.code === '23505') {
      return { ok: false, error: { code: 'VALIDATION_ERROR', message: DUPLICATE_NAME_MESSAGE } };
    }
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
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

  const { error } = await supabase
    .from('service_categories')
    .update({ is_visible: !category.is_visible })
    .eq('id', parsed.data.id)
    .eq('tenant_id', tenantId);

  if (error) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
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

  const { error: firstError } = await supabase
    .from('service_categories')
    .update({ sort_order: swap.neighbour.sortOrder })
    .eq('id', swap.current.id)
    .eq('tenant_id', tenantId);
  const { error: secondError } = await supabase
    .from('service_categories')
    .update({ sort_order: swap.current.sortOrder })
    .eq('id', swap.neighbour.id)
    .eq('tenant_id', tenantId);

  if (firstError || secondError) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível reordenar. Tente novamente.' },
    };
  }

  revalidatePath('/dashboard/servicos');
  return { ok: true, value: null };
}
