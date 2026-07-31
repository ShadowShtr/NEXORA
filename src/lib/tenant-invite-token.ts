import { createHash, randomBytes } from 'node:crypto';

// NEX-212: split out from tenant-invite.ts so pure token generation/hashing can be
// unit-tested without pulling in src/lib/supabase/admin.ts, which parses the full env
// schema (src/lib/env.ts) eagerly at import time — every unit test importing it would
// need every Supabase env var present, same reasoning documented in rate-limit.ts.
export const INVITE_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export function generateInviteToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
