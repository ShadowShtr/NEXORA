'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import {
  loginSchema,
  requestPasswordResetSchema,
  updatePasswordSchema,
} from '@/lib/validation/auth';
import {
  checkLoginEmailRateLimit,
  checkLoginIpRateLimit,
  checkPasswordResetRateLimit,
} from '@/lib/rate-limit';
import { getRequestIp } from '@/lib/request-ip';
import { getRequestId } from '@/lib/request-id';
import { logEvent } from '@/lib/logger';
import { severityForErrorCode } from '@/lib/metrics';
import type { Result } from '@/lib/result';

export async function login(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Introduza um e-mail e palavra-passe válidos.' },
    };
  }

  // NEX-166 (security review): login had no application-level rate limit — only
  // Supabase Auth's own built-in, unconfigurable throttling. Checked by IP and by
  // e-mail (case-insensitive) so a targeted attack against one account isn't only
  // rate-limited when it comes from a single source IP. Folded into the exact same
  // generic error as a wrong password below — a distinct "too many attempts" message
  // would itself be a new way to tell a rate-limited guess from a merely wrong one.
  const ip = await getRequestIp();
  const requestId = await getRequestId();
  const [ipLimit, emailLimit] = await Promise.all([
    checkLoginIpRateLimit(ip),
    checkLoginEmailRateLimit(parsed.data.email.toLowerCase()),
  ]);
  if (ipLimit.limited || emailLimit.limited) {
    // NEX-171: "Métricas e alertas" — the "login failures" metric. Never logs the
    // e-mail itself (logger.ts would redact it anyway by key name, but there's no
    // reason to pass it at all) — ipLimited/emailLimited as booleans are enough to
    // tell a targeted attack (repeated emailLimited across different IPs) from a
    // broad one (repeated ipLimited across different accounts) without any PII.
    logEvent(
      severityForErrorCode('RATE_LIMITED'),
      'auth.login.rate_limited',
      { ipLimited: ipLimit.limited, emailLimited: emailLimit.limited },
      requestId,
    );
    return {
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: 'E-mail ou palavra-passe incorretos.' },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Generic message regardless of cause: never reveal whether the e-mail exists.
    logEvent(severityForErrorCode('UNAUTHENTICATED'), 'auth.login.failed', {}, requestId);
    return {
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: 'E-mail ou palavra-passe incorretos.' },
    };
  }

  logEvent('info', 'auth.login.succeeded', {}, requestId);
  redirect('/dashboard');
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function requestPasswordReset(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = requestPasswordResetSchema.safeParse({ email: formData.get('email') });

  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Introduza um e-mail válido.' },
    };
  }

  // NEX-166 (security review): this comment already documented "or the call was
  // rate-limited" as part of the response contract below, but no rate limit actually
  // existed yet — a recovery e-mail is a real cost (spams a victim's inbox), so this
  // is tighter than the login limiters above. Limited by IP only: the response is
  // already identical whether the address exists or not, so an e-mail-keyed limit
  // would add no extra secrecy, only extra Redis calls.
  const ip = await getRequestIp();
  const rateLimit = await checkPasswordResetRateLimit(ip);
  if (!rateLimit.limited) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      // This project's recovery links use the implicit flow (tokens in the URL hash
      // fragment, never sent to the server), consumed client-side by /definir-password
      // — not a server-exchanged `?code=`. redirectTo is a fixed internal path, never
      // derived from user input, which is the strongest form of a redirect allowlist.
      redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/definir-password`,
    });
  }

  // Always the same response, whether or not the e-mail matches an account or the
  // call was rate-limited — never reveal account existence or internal state.
  return { ok: true, value: null };
}

export async function updatePassword(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = updatePasswordSchema.safeParse({ password: formData.get('password') });

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Palavra-passe inválida.',
      },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return {
      ok: false,
      error: {
        code: 'UNAUTHENTICATED',
        message: 'Não foi possível definir a palavra-passe. Peça um novo link de recuperação.',
      },
    };
  }

  redirect('/dashboard');
}
