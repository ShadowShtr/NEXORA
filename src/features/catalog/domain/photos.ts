// Menu-style thumbnail for a service (public, 0025_service_photos_and_package_promotions.sql)
// — distinct from src/features/clients/domain/photos.ts, which gates the private
// client-history photos (NEX-094). Same MIME/size allowlist reasoning: the upload
// action re-encodes every accepted file to JPEG via sharp regardless of input format,
// so this is intentionally a little broader than the single format that ends up in
// Storage.
export const ALLOWED_SERVICE_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_SERVICE_PHOTO_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB — a phone photo, pre-compression headroom

export function isAllowedServicePhotoMimeType(mimeType: string): boolean {
  return (ALLOWED_SERVICE_PHOTO_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function isAllowedServicePhotoSize(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_SERVICE_PHOTO_SIZE_BYTES;
}
