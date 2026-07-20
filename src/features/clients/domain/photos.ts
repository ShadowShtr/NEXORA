// NEX-094: "Fotografias privadas" — kinds mirror the client_photos.kind check constraint
// (0001_initial.sql: 'before' | 'after' | 'other'). MIME/size here gate the raw browser
// File before it's even read into memory; the upload action re-encodes every accepted
// file to JPEG via sharp regardless of input format (strips EXIF, and rejects anything
// that doesn't actually decode as an image), so this allowlist is intentionally a little
// broader than the single format that ends up in Storage
// (supabase/migrations/0019_client_photos_storage.sql).
export const CLIENT_PHOTO_KINDS = ['before', 'after', 'other'] as const;
export type ClientPhotoKind = (typeof CLIENT_PHOTO_KINDS)[number];

export const CLIENT_PHOTO_KIND_LABELS: Record<ClientPhotoKind, string> = {
  before: 'Antes',
  after: 'Depois',
  other: 'Outra',
};

export function isClientPhotoKind(value: string): value is ClientPhotoKind {
  return (CLIENT_PHOTO_KINDS as readonly string[]).includes(value);
}

export const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_PHOTO_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB — a phone photo, pre-compression headroom

export function isAllowedPhotoMimeType(mimeType: string): boolean {
  return (ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function isAllowedPhotoSize(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_PHOTO_SIZE_BYTES;
}
