import { z } from 'zod';

export const INSTAGRAM_HANDLE_PATTERN = /^[A-Za-z0-9._]{1,30}$/;

// The dona commonly types the handle the way she'd write it anywhere else — with a
// leading "@" — so this strips exactly one before validating/storing; the stored value
// and the DB check constraint (0030_business_public_profile.sql) never include it, the
// public page prepends it back for display.
export function normalizeInstagramHandle(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}

export const publicProfileSchema = z.object({
  specialty: z.string().trim().max(80),
  aboutDescription: z.string().trim().max(600),
  instagramHandle: z.string().trim().max(30),
  bookingEnabled: z.boolean(),
});

export type PublicProfileInput = z.infer<typeof publicProfileSchema>;
