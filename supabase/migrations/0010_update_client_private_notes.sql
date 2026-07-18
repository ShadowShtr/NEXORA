-- NEX-093: "Observações privadas" — "Editar com auditoria e limites". clients has no
-- authenticated UPDATE-with-audit path today (0001_initial.sql only grants ordinary
-- authenticated CRUD on clients, with no audit_logs write — authenticated only has
-- SELECT on audit_logs, "drafts and audit logs are server-managed"). This function is
-- that path for private_notes specifically: derives tenant_id from
-- current_tenant_id() (never a parameter, same boundary as every other mutating RPC in
-- this codebase — NEX-064/084/085), verifies the client belongs to the caller's own
-- tenant, updates the note, and writes an audit_logs row recording *that* it changed
-- (not the note's contents — the note itself is already in `clients`, and audit_logs
-- being append-only/broadly SELECT-able to the tenant makes duplicating PII into it
-- undesirable, docs/05_SECURITY_PRIVACY.md "T8 Logs com PII").
create or replace function public.update_client_private_notes(p_client_id uuid, p_private_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  v_tenant_id := public.current_tenant_id();
  if v_tenant_id is null then
    raise exception 'no tenant for current user' using errcode = '42501';
  end if;

  if p_private_notes is not null and char_length(p_private_notes) > 2000 then
    raise exception 'private notes must be at most 2000 characters' using errcode = '22001';
  end if;

  update public.clients
  set private_notes = nullif(p_private_notes, '')
  where id = p_client_id and tenant_id = v_tenant_id;

  if not found then
    raise exception 'client % not found for tenant', p_client_id using errcode = '22023';
  end if;

  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_tenant_id, auth.uid(), 'client.private_notes_updated', 'client', p_client_id, '{}'::jsonb);
end;
$$;

-- Owner-only: revoked from PUBLIC/anon explicitly per ADR-008, granted only to
-- authenticated.
revoke all on function public.update_client_private_notes(uuid, text) from public;
revoke all on function public.update_client_private_notes(uuid, text) from anon;
grant execute on function public.update_client_private_notes(uuid, text) to authenticated;
