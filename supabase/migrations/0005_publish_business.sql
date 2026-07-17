-- NEX-035: publish the public booking link (slug) and activate the tenant.
--
-- Unlike provision_tenant_owner (admin-only bootstrap), this function is meant to be
-- called by the owner through their own authenticated session. `tenants` only has a
-- SELECT policy for authenticated (`tenant_read_self`, 0001_initial.sql) — there is no
-- UPDATE policy, because letting the client update `slug`/`status` directly would need
-- a much wider RLS carve-out. A security definer function gives the same outcome more
-- safely: tenant_id is derived from current_tenant_id() (the caller's own session),
-- never taken as a parameter, so an authenticated owner can only ever publish their own
-- tenant. Slug format/uniqueness stay enforced by the existing `tenants` check/unique
-- constraints (0001_initial.sql) — no need to duplicate that validation here.
create or replace function public.publish_business(p_slug text)
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

  update public.tenants
  set slug = p_slug, status = 'active'
  where id = v_tenant_id;

  -- coalesce: republishing (e.g. after later editing the slug) keeps the original
  -- publish date instead of resetting it.
  update public.business_settings
  set published_at = coalesce(published_at, now())
  where tenant_id = v_tenant_id;

  insert into public.audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, metadata)
  values (v_tenant_id, auth.uid(), 'business.published', 'tenant', v_tenant_id, jsonb_build_object('slug', p_slug));
end;
$$;

-- New functions in `public` are reachable by anon/authenticated by default on this
-- project (see 0003_provision_tenant_owner.sql) — revoking from PUBLIC alone does not
-- remove those direct grants, so both are revoked explicitly before re-granting only to
-- authenticated (this function, unlike provision_tenant_owner, IS meant to be called by
-- the owner's normal session, never by anon).
revoke all on function public.publish_business(text) from public;
revoke all on function public.publish_business(text) from anon;
grant execute on function public.publish_business(text) to authenticated;
