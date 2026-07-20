'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import { reencodePhotoAsJpeg } from '@/lib/image-processing';
import {
  CLIENT_PHOTO_KINDS,
  isAllowedPhotoMimeType,
  isAllowedPhotoSize,
} from './domain/photos';
import type { Result } from '@/lib/result';

const uploadSchema = z.object({
  clientId: z.uuid(),
  kind: z.enum(CLIENT_PHOTO_KINDS),
  file: z.instanceof(File),
});

// NEX-094: "Upload seguro" — tenant_id always comes from requireProfile()'s session,
// never from the form, so the storage path and the client_photos row can only ever land
// in the caller's own tenant; a clientId belonging to a different tenant is rejected by
// the composite FK on client_photos (tenant_id, client_id) references clients (tenant_id,
// id) — 0002_harden_tenant_fk_integrity.sql — the same defense-in-depth pattern every
// other tenant-scoped resource in this schema uses, not a check reimplemented here.
export async function uploadClientPhoto(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = uploadSchema.safeParse({
    clientId: formData.get('clientId'),
    kind: formData.get('kind'),
    file: formData.get('file'),
  });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } };
  }
  const { clientId, kind, file } = parsed.data;

  if (file.size === 0) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Escolha uma fotografia.' } };
  }
  if (!isAllowedPhotoSize(file.size)) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'A fotografia não pode exceder 8 MB.' },
    };
  }
  if (!isAllowedPhotoMimeType(file.type)) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Formato não suportado. Use JPEG, PNG ou WEBP.' },
    };
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();

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

  const storagePath = `${tenantId}/${clientId}/${randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('client-photos')
    .upload(storagePath, jpegBuffer, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível enviar a fotografia.' },
    };
  }

  const { error: insertError } = await supabase
    .from('client_photos')
    .insert({ tenant_id: tenantId, client_id: clientId, kind, storage_path: storagePath });
  if (insertError) {
    await supabase.storage.from('client-photos').remove([storagePath]);
    if (insertError.code === '23503') {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Cliente não encontrada.' } };
    }
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar a fotografia.' },
    };
  }

  revalidatePath(`/dashboard/clientes/${clientId}`);
  return { ok: true, value: null };
}

const deleteSchema = z.object({ photoId: z.uuid(), clientId: z.uuid() });

// RLS (client_photos_delete, 0001_initial.sql) is the actual authorization boundary — a
// photoId belonging to another tenant simply matches zero rows, same pattern as every
// other authenticated mutation on a tenant-scoped table in this codebase.
export async function deleteClientPhoto(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = deleteSchema.safeParse({
    photoId: formData.get('photoId'),
    clientId: formData.get('clientId'),
  });
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' } };
  }

  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('client_photos')
    .delete()
    .eq('id', parsed.data.photoId)
    .select('storage_path')
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Fotografia não encontrada.' } };
  }

  // Best-effort: the client_photos row is already gone (what the UI/RLS-scoped listing
  // relies on), so a failure here only leaves an orphaned, still tenant-scoped object in
  // Storage rather than an inconsistent, user-visible state.
  await supabase.storage.from('client-photos').remove([data.storage_path]);

  revalidatePath(`/dashboard/clientes/${parsed.data.clientId}`);
  return { ok: true, value: null };
}
