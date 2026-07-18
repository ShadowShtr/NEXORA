import { z } from 'zod';

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  APP_TIMEZONE: z.string().default('Europe/Lisbon'),
  BOOKING_TOKEN_PEPPER: z.string().min(32).optional(),
  // 32 bytes hex (64 chars) — AES-256-GCM key for booking_drafts.encrypted_payload
  // (NEX-052). Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  BOOKING_DRAFT_ENCRYPTION_KEY: z.string().length(64).optional(),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

export const serverEnv = () =>
  serverSchema.parse({
    ...publicEnv,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    APP_TIMEZONE: process.env.APP_TIMEZONE,
    BOOKING_TOKEN_PEPPER: process.env.BOOKING_TOKEN_PEPPER,
    BOOKING_DRAFT_ENCRYPTION_KEY: process.env.BOOKING_DRAFT_ENCRYPTION_KEY,
  });
