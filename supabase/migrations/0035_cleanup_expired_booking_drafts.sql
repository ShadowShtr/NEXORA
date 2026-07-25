-- NEX-161: "Retenção e limpeza de drafts — job/processo remove expirados."
--
-- booking_drafts (NEX-052) already has expires_at (<= created_at + 24h) and lazy
-- cleanup on read: resumeBookingDraft deletes a row the moment someone tries to
-- resume it past expiry (src/app/b/[slug]/draft-actions.ts). That only covers the
-- visitor who comes back. The much more common case — a draft nobody ever revisits —
-- was never deleted at all, sitting expired-but-present indefinitely (CLAUDE.md: "não
-- guardar rascunhos abandonados indefinidamente"). This function is the proactive
-- half: called on a schedule (Vercel Cron, src/app/api/cron/cleanup-booking-drafts)
-- rather than only in reaction to a specific visitor's request.
create or replace function public.cleanup_expired_booking_drafts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_count integer;
begin
  delete from public.booking_drafts where expires_at < now();
  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

-- Same shape as provision_tenant_owner (0003): a maintenance operation with no
-- calling tenant session, meant to run only from trusted server-side code (the cron
-- route, using the service-role client) — never anon, never authenticated. New
-- functions in `public` are reachable by the Data API roles by default on this
-- project (supabase/config.toml `auto_expose_new_tables`), so both must be revoked
-- explicitly, not just PUBLIC (ADR-008).
revoke all on function public.cleanup_expired_booking_drafts() from public;
revoke all on function public.cleanup_expired_booking_drafts() from anon;
revoke all on function public.cleanup_expired_booking_drafts() from authenticated;
grant execute on function public.cleanup_expired_booking_drafts() to service_role;
