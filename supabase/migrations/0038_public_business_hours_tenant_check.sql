-- NEX-166 (security review): get_public_business_hours (0030_business_public_profile.sql)
-- is security definer, granted directly to anon/authenticated, and trusted p_tenant_id
-- without checking the tenant is actually published — unlike create_public_booking,
-- which validates `tenants.status = 'active' and business_settings.published_at is not
-- null` internally (0023_create_public_booking_observation.sql). The original comment
-- assumed every caller already resolved tenant_id through an already-public lookup (the
-- /b/[slug] pages do), but the function is reachable directly via RPC with just the
-- publishable key, bypassing that page-level check entirely — anyone who already has or
-- guesses a tenant_id (UUID) could read the weekly hours of a suspended, deleted, or
-- still-onboarding tenant. Low impact (only day_of_week/is_open/opens_at/closes_at, no
-- client data), but out of line with the rest of this public surface, so closing it the
-- same way: filtering to the tenant's own published state, matching
-- create_public_booking's exact predicate.
create or replace function public.get_public_business_hours(p_tenant_id uuid)
returns table (day_of_week smallint, is_open boolean, opens_at time, closes_at time)
language sql
stable
security definer
set search_path = public
as $$
  select bh.day_of_week, bh.is_open, bh.opens_at, bh.closes_at
  from public.business_hours bh
  join public.tenants t on t.id = bh.tenant_id
  join public.business_settings bs on bs.tenant_id = bh.tenant_id
  where bh.tenant_id = p_tenant_id and t.status = 'active' and bs.published_at is not null;
$$;
