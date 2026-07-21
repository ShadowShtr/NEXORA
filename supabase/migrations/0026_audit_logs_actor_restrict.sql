-- 0004_audit_logs_immutable.sql already fixed this exact problem for audit_logs.tenant_id
-- (on delete set null -> on delete restrict), reasoning that a hard delete needing to
-- null out part of the append-only audit trail should be blocked outright rather than
-- silently allowed. audit_logs.actor_user_id has the identical shape (references
-- auth.users(id) on delete set null) and was missed in that pass.
--
-- Every provisioned tenant owner gets an audit_logs row via provision_tenant_owner
-- (actor_user_id = the new owner). Deleting that auth.users row via the Admin API makes
-- Postgres issue an internal UPDATE ... SET actor_user_id = NULL on that row as part of
-- the FK's SET NULL action — which the audit_logs_no_update trigger unconditionally
-- rejects, so the whole DELETE fails with a generic 500 ("audit_logs is append-only:
-- UPDATE is not permitted") instead of a clear, expected FK violation. Hard-deleting an
-- auth user is not a designed product flow here either (same as tenant hard-delete) —
-- restrict is the correct, consistent behavior: block it with a standard error while
-- audit history exists, rather than let deletion touch the trail.
alter table public.audit_logs drop constraint audit_logs_actor_user_id_fkey;
alter table public.audit_logs
  add constraint audit_logs_actor_user_id_fkey foreign key (actor_user_id) references auth.users (id) on delete restrict;
