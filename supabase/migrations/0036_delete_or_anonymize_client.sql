-- NEX-163: "Apagar/anonimizar cliente — workflow preserva obrigações e remove
-- storage." appointments.client_id is `on delete restrict` (0001_initial.sql) — a
-- client with any appointment history literally cannot be hard-deleted at the
-- database level without breaking the financial/audit trail those rows carry. This
-- function makes that constraint the actual product decision instead of a surprise
-- error: no history → real delete; any history → anonymize in place (name/phone/
-- email/preferences/private_notes scrubbed, appointments/payments kept untouched).
-- Either way, client_photos rows are removed here; the caller (a Server Action, which
-- alone can reach the Storage API) deletes the underlying files using the
-- storage_paths this function returns.
alter table public.clients add column anonymized_at timestamptz;

create or replace function public.delete_or_anonymize_client(p_client_id uuid)
returns table (action text, storage_paths text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_appointment_count integer;
  v_storage_paths text[];
  v_action text;
  v_anon_phone text;
begin
  v_tenant_id := public.current_tenant_id();
  if v_tenant_id is null then
    raise exception 'no tenant for current user' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.clients where id = p_client_id and tenant_id = v_tenant_id
  ) then
    raise exception 'client % not found for tenant', p_client_id using errcode = '22023';
  end if;

  select coalesce(array_agg(cp.storage_path), '{}') into v_storage_paths
  from public.client_photos cp
  where cp.client_id = p_client_id and cp.tenant_id = v_tenant_id;

  delete from public.client_photos
  where client_id = p_client_id and tenant_id = v_tenant_id;

  select count(*) into v_appointment_count
  from public.appointments
  where client_id = p_client_id and tenant_id = v_tenant_id;

  if v_appointment_count = 0 then
    delete from public.clients where id = p_client_id and tenant_id = v_tenant_id;
    v_action := 'deleted';
  else
    -- appointments.client_observation (NEX-064) is text the client herself wrote at
    -- booking time — personal data, distinct from appointment_items.description
    -- (service names, needed for the financial record and left untouched).
    update public.appointments
    set client_observation = null
    where client_id = p_client_id and tenant_id = v_tenant_id
      and client_observation is not null;

    -- clients.phone_e164 is NOT NULL, checked against E.164 shape, and unique per
    -- tenant — can't just clear it. Derived deterministically from the client's own
    -- (already-unique) id via the built-in hashtext() rather than random(), so this
    -- can never flake in a test; collision odds are the same astronomically small
    -- margin this codebase already accepts elsewhere (booking lookup codes).
    v_anon_phone := '+999' || lpad((abs(hashtext(p_client_id::text)) % 1000000000)::text, 9, '0');

    update public.clients
    set
      name = 'Cliente removida',
      phone_e164 = v_anon_phone,
      email = null,
      private_notes = null,
      preferences = '{}'::jsonb,
      anonymized_at = now()
    where id = p_client_id and tenant_id = v_tenant_id;

    v_action := 'anonymized';
  end if;

  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (
    v_tenant_id, auth.uid(),
    case when v_action = 'deleted' then 'client.deleted' else 'client.anonymized' end,
    'client', p_client_id,
    jsonb_build_object('photos_removed', coalesce(array_length(v_storage_paths, 1), 0))
  );

  return query select v_action, v_storage_paths;
end;
$$;

revoke all on function public.delete_or_anonymize_client(uuid) from public;
revoke all on function public.delete_or_anonymize_client(uuid) from anon;
grant execute on function public.delete_or_anonymize_client(uuid) to authenticated;
