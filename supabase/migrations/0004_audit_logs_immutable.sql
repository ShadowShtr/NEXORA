-- NEX-014: audit_logs must be genuinely append-only.
--
-- RLS already denies UPDATE/DELETE to anon/authenticated (0001 only defines a SELECT
-- policy). That is not enough on its own: `service_role` has BYPASSRLS, so RLS policies
-- never apply to it — and audit rows are written by security-definer functions and
-- admin scripts running as service_role. Without a trigger, a bug in that
-- server-side code (or a future migration) could silently rewrite or delete history.
-- Triggers fire for every role regardless of BYPASSRLS, so this is a stronger,
-- structural guarantee than RLS can provide for this specific table.

-- 0001 defined audit_logs.tenant_id with `on delete set null`, so hard-deleting a
-- tenant issues an internal UPDATE on every audit_logs row that references it — which
-- the trigger below would also reject, making it impossible to ever delete a tenant
-- with audit history. Tenant removal in this product is a soft delete
-- (tenant_status = 'deleted'); a hard DELETE FROM tenants is not a designed product
-- flow, so it is fine — correct, even — to block it outright while audit history
-- exists, rather than let deletion silently null out part of the trail.
alter table public.audit_logs drop constraint audit_logs_tenant_id_fkey;
alter table public.audit_logs
  add constraint audit_logs_tenant_id_fkey foreign key (tenant_id) references public.tenants (id) on delete restrict;

create or replace function public.reject_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs is append-only: % is not permitted', TG_OP;
end;
$$;

create trigger audit_logs_no_update before update on public.audit_logs
  for each row execute function public.reject_audit_log_mutation();

create trigger audit_logs_no_delete before delete on public.audit_logs
  for each row execute function public.reject_audit_log_mutation();
