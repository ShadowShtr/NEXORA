import type { SupabaseClient } from '@supabase/supabase-js';
import { errorMessage, logEvent } from '@/lib/logger';

// NEX-135: "Logging" — an audit trail of who exported what, when, via
// log_finance_export (supabase/migrations/0034_log_finance_export.sql). Best-effort: a
// logging failure must never block the actual export download, which is the feature the
// owner is actually waiting on — swallowed the same way a non-critical side effect would
// be anywhere else in this codebase, rather than surfaced as a user-facing error.
//
// NEX-171: previously destructured neither `data` nor `error` from the RPC call, so a
// genuine Postgrest error response (as opposed to a network-level exception) passed
// through completely unnoticed — the try/catch here only ever catches the latter.
// Both are now at least logged (still never thrown) so a silent audit-trail gap is
// visible instead of invisible.
export async function logFinanceExport(
  supabase: SupabaseClient,
  format: 'csv' | 'xlsx' | 'pdf',
  view: string,
  rangeDays: number,
  requestId?: string | null,
): Promise<void> {
  try {
    const { error } = await supabase.rpc('log_finance_export', {
      p_format: format,
      p_view: view,
      p_range_days: rangeDays,
    });
    if (error) {
      logEvent(
        'warn',
        'finance.export.audit_log_failed',
        { format, message: errorMessage(error) },
        requestId,
      );
    }
  } catch (error) {
    logEvent(
      'warn',
      'finance.export.audit_log_failed',
      { format, message: errorMessage(error) },
      requestId,
    );
  }
}
