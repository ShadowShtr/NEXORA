import type { EmailProvider } from './provider';
import { ResendEmailProvider } from './resend-provider';
import { NoopEmailProvider } from './noop-provider';

export type { EmailMessage, EmailProvider, EmailSendResult } from './provider';

// Reads process.env directly, not through src/lib/env.ts's serverEnv() — that module's
// eager parse of the full app schema (required NEXT_PUBLIC_* Supabase vars included)
// would make every unit test importing this file depend on unrelated env vars, the
// same issue fixed for rate-limit.ts/turnstile.ts in NEX-066.
export function getEmailProvider(): EmailProvider {
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return new NoopEmailProvider();
  return new ResendEmailProvider(apiKey, from);
}
