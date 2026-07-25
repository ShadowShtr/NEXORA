import { z } from 'zod';

// .env.example lists every optional var with an empty value ("KEY=") as the documented
// "not configured" state (docs/ENVIRONMENTS_AND_SECRETS.md: "contém apenas placeholders
// vazios"). z.string().optional() alone only accepts `undefined`, not `''` — without
// this, loading that exact documented empty state throws instead of degrading
// gracefully. Applied to every optional server var below.
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  // Public site key for the Turnstile widget (NEX-066) — safe to expose, mirrors
  // reCAPTCHA/hCaptcha's site-key convention. Must carry the NEXT_PUBLIC_ prefix or
  // Next.js never inlines it into the client bundle. Optional: bot protection degrades
  // to rate-limit-only when unset, same "planned, not yet configured" pattern as the
  // other optional server secrets below.
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyToUndefined, z.string().min(20).optional()),
  APP_TIMEZONE: z.string().default('Europe/Lisbon'),
  // 32 bytes hex (64 chars) — AES-256-GCM key for booking_drafts.encrypted_payload
  // (NEX-052). Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  BOOKING_DRAFT_ENCRYPTION_KEY: z.preprocess(emptyToUndefined, z.string().length(64).optional()),
  // Upstash Redis REST credentials (NEX-066) — distributed rate limit backend, per
  // CLAUDE.md: "Não implemente rate limit em memória para produção serverless." Both
  // optional: unset means rate limiting is skipped rather than the app failing to boot.
  RATE_LIMIT_REDIS_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  RATE_LIMIT_REDIS_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  TURNSTILE_SECRET_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  // Verifies that /api/cron/cleanup-booking-drafts (NEX-161) is really called by
  // Vercel Cron and not by anyone who finds the URL. Optional, matching this project's
  // established degrade pattern for not-yet-provisioned secrets: unset means the
  // endpoint accepts any caller — low-risk here (the only effect is deleting rows that
  // are already expired), unlike the other secrets above.
  CRON_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
});

export const serverEnv = () =>
  serverSchema.parse({
    ...publicEnv,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    APP_TIMEZONE: process.env.APP_TIMEZONE,
    BOOKING_DRAFT_ENCRYPTION_KEY: process.env.BOOKING_DRAFT_ENCRYPTION_KEY,
    RATE_LIMIT_REDIS_URL: process.env.RATE_LIMIT_REDIS_URL,
    RATE_LIMIT_REDIS_TOKEN: process.env.RATE_LIMIT_REDIS_TOKEN,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
  });
