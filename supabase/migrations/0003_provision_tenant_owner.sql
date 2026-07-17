-- NEX-013: atomic tenant/profile/business_settings provisioning.
--
-- There is no public sign-up in this version (CLAUDE.md: "Não criar cadastro público
-- da dona na primeira versão"). Provisioning is an admin-only bootstrap operation:
-- the auth.users row is created separately via the Supabase Auth Admin API (which owns
-- password/credential handling), then this function links it to a brand-new tenant.
-- Everything below runs inside a single function call, so any failure — a constraint
-- violation, a duplicate slug — rolls back every statement automatically; nothing is
-- left half-provisioned.
create or replace function public.provision_tenant_owner(
  p_user_id uuid,
  p_slug text,
  p_business_name text,
  p_owner_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required' using errcode = '22004';
  end if;

  if exists (select 1 from public.profiles where user_id = p_user_id) then
    raise exception 'user % is already provisioned', p_user_id using errcode = '23505';
  end if;

  insert into public.tenants (slug, name, status)
  values (p_slug, p_business_name, 'setup')
  returning id into v_tenant_id;

  insert into public.profiles (user_id, tenant_id, role, display_name)
  values (p_user_id, v_tenant_id, 'owner', p_owner_display_name);

  insert into public.business_settings (tenant_id, professional_name)
  values (v_tenant_id, p_owner_display_name);

  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_tenant_id, p_user_id, 'tenant.provisioned', 'tenant', v_tenant_id, jsonb_build_object('slug', p_slug));

  return v_tenant_id;
end;
$$;

-- Admin-only: not exposed to anon/authenticated. New functions in `public` are
-- reachable by the Data API roles by default on this project (see
-- supabase/config.toml `auto_expose_new_tables`) — revoking from PUBLIC alone does not
-- remove grants Supabase applies directly to anon/authenticated, so both are revoked
-- explicitly. Only a service-role caller (the admin script, run by the owner) may
-- provision a new tenant.
revoke all on function public.provision_tenant_owner(uuid, text, text, text) from public;
revoke all on function public.provision_tenant_owner(uuid, text, text, text) from anon;
revoke all on function public.provision_tenant_owner(uuid, text, text, text) from authenticated;
grant execute on function public.provision_tenant_owner(uuid, text, text, text) to service_role;
