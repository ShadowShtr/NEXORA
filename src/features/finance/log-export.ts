import type { SupabaseClient } from '@supabase/supabase-js';

// NEX-135: "Logging" — an audit trail of who exported what, when, via
// log_finance_export (supabase/migrations/0034_log_finance_export.sql). Best-effort: a
// logging failure must never block the actual export download, which is the feature the
// owner is actually waiting on — swallowed the same way a non-critical side effect would
// be anywhere else in this codebase, rather than surfaced as a user-facing error.
export async function logFinanceExport(
  supabase: SupabaseClient,
  format: 'csv' | 'xlsx' | 'pdf',
  view: string,
  rangeDays: number,
): Promise<void> {
  try {
    await supabase.rpc('log_finance_export', {
      p_format: format,
      p_view: view,
      p_range_days: rangeDays,
    });
  } catch {
    // Best-effort — see module comment above.
  }
}
