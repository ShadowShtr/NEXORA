'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import {
  loginSchema,
  requestPasswordResetSchema,
  updatePasswordSchema,
} from '@/lib/validation/auth';
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Generic message regardless of cause: never reveal whether the e-mail exists.
    return {
      ok: false,
      error: { code: 'UNAUTHENTICATED', message: 'E-mail ou palavra-passe incorretos.' },
    };
  }

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

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    // This project's recovery links use the implicit flow (tokens in the URL hash
    // fragment, never sent to the server), consumed client-side by /definir-password —
    // not a server-exchanged `?code=`. redirectTo is a fixed internal path, never
    // derived from user input, which is the strongest form of a redirect allowlist.
    redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/definir-password`,
  });

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
