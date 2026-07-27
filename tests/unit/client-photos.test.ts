import { describe, expect, it } from 'vitest';
import {
  ALLOWED_PHOTO_MIME_TYPES,
  hasReachedPhotoQuota,
  isAllowedPhotoMimeType,
  isAllowedPhotoSize,
  isClientPhotoKind,
  MAX_PHOTO_SIZE_BYTES,
  MAX_PHOTOS_PER_CLIENT,
} from '@/features/clients/domain/photos';

describe('isAllowedPhotoMimeType', () => {
  it.each(ALLOWED_PHOTO_MIME_TYPES)('accepts %s', (mime) => {
    expect(isAllowedPhotoMimeType(mime)).toBe(true);
  });

  it('rejects SVG and executables (docs/05_SECURITY_PRIVACY.md, "Uploads")', () => {
    expect(isAllowedPhotoMimeType('image/svg+xml')).toBe(false);
    expect(isAllowedPhotoMimeType('application/x-msdownload')).toBe(false);
    expect(isAllowedPhotoMimeType('text/html')).toBe(false);
  });

  it('rejects an empty/unknown mime type', () => {
    expect(isAllowedPhotoMimeType('')).toBe(false);
  });
});

describe('isAllowedPhotoSize', () => {
  it('accepts a size within the limit', () => {
    expect(isAllowedPhotoSize(1024)).toBe(true);
    expect(isAllowedPhotoSize(MAX_PHOTO_SIZE_BYTES)).toBe(true);
  });

  it('rejects zero, negative, or over-limit sizes', () => {
    expect(isAllowedPhotoSize(0)).toBe(false);
    expect(isAllowedPhotoSize(-1)).toBe(false);
    expect(isAllowedPhotoSize(MAX_PHOTO_SIZE_BYTES + 1)).toBe(false);
  });
});

describe('hasReachedPhotoQuota', () => {
  it('allows uploads while under the limit', () => {
    expect(hasReachedPhotoQuota(0)).toBe(false);
    expect(hasReachedPhotoQuota(MAX_PHOTOS_PER_CLIENT - 1)).toBe(false);
  });

  it('blocks uploads at or over the limit', () => {
    expect(hasReachedPhotoQuota(MAX_PHOTOS_PER_CLIENT)).toBe(true);
    expect(hasReachedPhotoQuota(MAX_PHOTOS_PER_CLIENT + 1)).toBe(true);
  });
});

describe('isClientPhotoKind', () => {
  it('accepts the three kinds matching the client_photos check constraint', () => {
    expect(isClientPhotoKind('before')).toBe(true);
    expect(isClientPhotoKind('after')).toBe(true);
    expect(isClientPhotoKind('other')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isClientPhotoKind('portfolio')).toBe(false);
    expect(isClientPhotoKind('')).toBe(false);
  });
});
