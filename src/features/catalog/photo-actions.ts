'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import { reencodePhotoAsJpeg } from '@/lib/image-processing';
import { isAllowedServicePhotoMimeType, isAllowedServicePhotoSize } from './domain/photos';
import { hasAffectedRows } from '@/lib/write-confirmation';
import type { Result } from '@/lib/result';

const uploadSchema = z.object({
  serviceId: z.uuid(),
  file: z.instanceof(File),
});

// A service has exactly one photo (unlike client_photos' gallery-per-client shape) —
// uploading replaces whatever was there before. tenant_id always comes from
// requireProfile()'s session, never the form, so this can only ever touch the caller's
// own tenant's service (the .eq('tenant_id', tenantId) below, same pattern as every
// other mutation in src/features/catalog/actions.ts).
export async function uploadServicePhoto(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = uploadSchema.safeParse({
    serviceId: formData.get('serviceId'),
    file: formData.get('file'),
  });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } };
  }
  const { serviceId, file } = parsed.data;

  if (file.size === 0) {
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

  const { data: service } = await supabase
    .from('services')
    .select('id, photo_path')
    .eq('id', serviceId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!service) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Serviço não encontrado.' } };
  }

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

  const storagePath = `${tenantId}/${serviceId}/${randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('service-photos')
    .upload(storagePath, jpegBuffer, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível enviar a fotografia.' },
    };
  }

  const { data: updated, error: updateError } = await supabase
    .from('services')
    .update({ photo_path: storagePath })
    .eq('id', serviceId)
    .eq('tenant_id', tenantId)
    .select('id');
  if (updateError || !hasAffectedRows(updated)) {
    // The row never pointed at storagePath (either the update errored, or it matched
    // zero rows — a concurrent delete between the check above and here) — remove the
    // just-uploaded object rather than leave it orphaned in Storage.
    await supabase.storage.from('service-photos').remove([storagePath]);
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar a fotografia.' },
    };
  }

  // Best-effort: the row already points at the new photo either way — a failure here
  // only leaves an orphaned object behind in Storage, not an inconsistent user-visible
  // state.
  if (service.photo_path) {
    await supabase.storage.from('service-photos').remove([service.photo_path]);
  }

  revalidatePath('/dashboard/servicos');
  return { ok: true, value: null };
}

const removeSchema = z.object({ serviceId: z.uuid() });

export async function removeServicePhoto(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = removeSchema.safeParse({ serviceId: formData.get('serviceId') });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Serviço inválido.' } };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const { data: service } = await supabase
    .from('services')
    .select('photo_path')
    .eq('id', parsed.data.serviceId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!service?.photo_path) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Sem fotografia para remover.' } };
  }

  const { data, error } = await supabase
    .from('services')
    .update({ photo_path: null })
    .eq('id', parsed.data.serviceId)
    .eq('tenant_id', tenantId)
    .select('id');
  if (error || !hasAffectedRows(data)) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível remover. Tente novamente.' },
    };
  }

  await supabase.storage.from('service-photos').remove([service.photo_path]);

  revalidatePath('/dashboard/servicos');
  return { ok: true, value: null };
}
