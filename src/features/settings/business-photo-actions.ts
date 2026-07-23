'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import { reencodePhotoAsJpeg } from '@/lib/image-processing';
import {
  isAllowedServicePhotoMimeType,
  isAllowedServicePhotoSize,
} from '@/features/catalog/domain/photos';
import { hasAffectedRows } from '@/lib/write-confirmation';
import type { Result } from '@/lib/result';

type BusinessImageField = 'logo_path' | 'cover_image_path';

// Logo and cover share the same shape (one optional image per tenant, replace = new
// upload + delete the old object) as service-photos
// (0025_service_photos_and_package_promotions.sql) — same MIME/size allowlist
// (src/features/catalog/domain/photos.ts, reused rather than duplicated), same
// re-encode-to-JPEG-via-sharp treatment (strips EXIF, doubles as signature check). The
// two differ only in which public bucket and which business_settings column they
// write to, so both upload/remove pairs share these two private helpers.
async function uploadBusinessImage(
  formData: FormData,
  bucket: 'business-logos' | 'business-covers',
  field: BusinessImageField,
): Promise<Result<null>> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Escolha uma fotografia.' } };
  }
  if (!isAllowedServicePhotoSize(file.size)) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'A fotografia não pode exceder 8 MB.' },
    };
  }
  if (!isAllowedServicePhotoMimeType(file.type)) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Formato não suportado. Use JPEG, PNG ou WEBP.' },
    };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data: current } = await supabase
    .from('business_settings')
    .select(field)
    .eq('tenant_id', tenantId)
    .maybeSingle<Record<BusinessImageField, string | null>>();

  let jpegBuffer: Buffer;
  try {
    const arrayBuffer = await file.arrayBuffer();
    jpegBuffer = await reencodePhotoAsJpeg(Buffer.from(arrayBuffer));
  } catch {
    // sharp throws for anything that doesn't actually decode as an image — a spoofed
    // Content-Type never reaches Storage (docs/05_SECURITY_PRIVACY.md, "verificação por
    // assinatura").
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Ficheiro de imagem inválido.' },
    };
  }

  const storagePath = `${tenantId}/${randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, jpegBuffer, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível enviar a fotografia.' },
    };
  }

  const { data: updated, error: updateError } = await supabase
    .from('business_settings')
    .update({ [field]: storagePath })
    .eq('tenant_id', tenantId)
    .select('tenant_id');
  if (updateError || !hasAffectedRows(updated)) {
    await supabase.storage.from(bucket).remove([storagePath]);
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar a fotografia.' },
    };
  }

  const previousPath = current?.[field];
  if (previousPath) {
    await supabase.storage.from(bucket).remove([previousPath]);
  }

  revalidatePath('/dashboard/definicoes');
  return { ok: true, value: null };
}

async function removeBusinessImage(
  bucket: 'business-logos' | 'business-covers',
  field: BusinessImageField,
): Promise<Result<null>> {
  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data: current } = await supabase
    .from('business_settings')
    .select(field)
    .eq('tenant_id', tenantId)
    .maybeSingle<Record<BusinessImageField, string | null>>();
  const existingPath = current?.[field];
  if (!existingPath) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Sem fotografia para remover.' } };
  }

  const { data, error } = await supabase
    .from('business_settings')
    .update({ [field]: null })
    .eq('tenant_id', tenantId)
    .select('tenant_id');
  if (error || !hasAffectedRows(data)) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível remover. Tente novamente.' },
    };
  }

  await supabase.storage.from(bucket).remove([existingPath]);

  revalidatePath('/dashboard/definicoes');
  return { ok: true, value: null };
}

export async function uploadBusinessLogo(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  return uploadBusinessImage(formData, 'business-logos', 'logo_path');
}

export async function removeBusinessLogo(
  _prevState: Result<null> | null,
  _formData: FormData,
): Promise<Result<null>> {
  return removeBusinessImage('business-logos', 'logo_path');
}

export async function uploadBusinessCover(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  return uploadBusinessImage(formData, 'business-covers', 'cover_image_path');
}

export async function removeBusinessCover(
  _prevState: Result<null> | null,
  _formData: FormData,
): Promise<Result<null>> {
  return removeBusinessImage('business-covers', 'cover_image_path');
}
