import { createClient } from '@supabase/supabase-js';
import { publicEnv, serverEnv } from '@/lib/env';

// Service-role client — bypasses RLS entirely. Server-only (never imported by a
// 'use client' component); the key itself never reaches the browser. Used where the
// caller genuinely has no session to scope a request by (e.g. an anonymous public
// visitor saving a booking draft, NEX-052) — everywhere else, prefer the normal
// cookie-scoped client from src/lib/supabase/server.ts.
export function createAdminClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }
  return createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}
