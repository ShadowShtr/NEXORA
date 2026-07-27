import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { serverEnv } from '@/lib/env';
import { errorMessage, logEvent } from '@/lib/logger';
import { getRequestId } from '@/lib/request-id';

export const dynamic = 'force-dynamic';

// NEX-161: "Retenção e limpeza de drafts — job/processo remove expirados e audita
// falhas." Scheduled by vercel.json to call cleanup_expired_booking_drafts()
// (supabase/migrations/0035) daily. A non-2xx response here shows up as a failed
// invocation in Vercel's own Cron Jobs dashboard — that dashboard is the audit trail
// for failures; this isn't a tenant-attributable business event, so it doesn't belong
// in audit_logs (every other row there has a real tenant_id, CLAUDE.md/ADR pattern).
export async function GET(request: Request) {
  const { CRON_SECRET } = serverEnv();
  if (!isAuthorizedCronRequest(request.headers.get('authorization'), CRON_SECRET)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const requestId = await getRequestId();

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc('cleanup_expired_booking_drafts');
    if (error) throw error;

    logEvent('info', 'cron.cleanup_booking_drafts.completed', { deleted: data }, requestId);
    return NextResponse.json(
      { ok: true, deleted: data },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    logEvent(
      'error',
      'cron.cleanup_booking_drafts.failed',
      { message: errorMessage(error) },
      requestId,
    );
    return NextResponse.json(
      { ok: false },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
