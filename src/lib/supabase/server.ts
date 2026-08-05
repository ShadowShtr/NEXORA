import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { publicEnv } from '@/lib/env';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot set cookies (Next.js only allows cookie writes
            // from Route Handlers, Server Actions, and Middleware) — @supabase/ssr
            // silently drops a just-refreshed session here when this call happens
            // during a Server Component render.
            //
            // PR2 audit correction (docs/audits/NEXORA_PERFORMANCE_AUDIT.md secção
            // 3.7): this comment used to claim "the root proxy refreshes sessions."
            // Verified false by reading src/middleware.ts in full — it only sets
            // CSP/no-store/x-request-id headers and never calls
            // supabase.auth.getUser() or otherwise touches the session. Where (or
            // whether) a refreshed session actually gets persisted across a request
            // path that only renders Server Components has not been re-verified
            // against current @supabase/ssr guidance. Tracked for PR3 (contexto
            // autenticado) — not fixed here, this commit only corrects the comment.
          }
        },
      },
    },
  );
}
