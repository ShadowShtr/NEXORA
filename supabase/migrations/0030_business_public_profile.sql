-- Visual refinement — página pública inicial (/b/[slug]): the reference reference
-- requires specialty/description/logo/cover as real, per-tenant configurable fields,
-- not decorative filler (CLAUDE.md: "dados apresentados devem vir de uma fonte real do
-- tenant"). booking_enabled lets the dona temporarily close online booking while
-- keeping the rest of the public page (contact/hours/location) visible — a real toggle
-- the settings UI writes to, not a hardcoded always-open assumption.
alter table public.business_settings
  add column specialty text check (specialty is null or char_length(specialty) <= 80),
  add column about_description text check (about_description is null or char_length(about_description) <= 600),
  add column instagram_handle text check (instagram_handle is null or instagram_handle ~ '^[A-Za-z0-9._]{1,30}$'),
  add column logo_path text,
  add column cover_image_path text,
  add column booking_enabled boolean not null default true;

-- Public buckets (unlike client-photos, 0019_client_photos_storage.sql): the public
-- landing page has no session, so a visitor needs to load these without auth — same
-- reasoning and same size/MIME allowlist as service-photos
-- (0025_service_photos_and_package_promotions.sql). Upload actions re-encode every
-- accepted file to JPEG via sharp before it reaches Storage (EXIF-strip + real
-- signature check, same as every other photo upload in this codebase).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('business-logos', 'business-logos', true, 8388608, array['image/jpeg']),
  ('business-covers', 'business-covers', true, 8388608, array['image/jpeg'])
on conflict (id) do nothing;

-- Object path convention: {tenant_id}/{uuid}.jpg — a public bucket serves reads through
-- the public URL endpoint without going through RLS at all, so these select policies
-- only matter for direct table/API access, not the public page's <img> tags. No update
-- policy: replacing a logo/cover is a delete + re-upload (new path), same convention as
-- every other photo field in this schema.
create policy business_logos_storage_select on storage.objects for select
using (bucket_id = 'business-logos');
create policy business_logos_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'business-logos' and (storage.foldername(name))[1] = public.current_tenant_id()::text);
create policy business_logos_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'business-logos' and (storage.foldername(name))[1] = public.current_tenant_id()::text);

create policy business_covers_storage_select on storage.objects for select
using (bucket_id = 'business-covers');
create policy business_covers_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'business-covers' and (storage.foldername(name))[1] = public.current_tenant_id()::text);
create policy business_covers_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'business-covers' and (storage.foldername(name))[1] = public.current_tenant_id()::text);

-- business_hours itself has no anon policy by design (docs/04_DATA_MODEL.md: "a agenda
-- em bruto nunca é exposta diretamente ao público, só os slots computados") — that rule
-- is about not letting an anonymous caller query scheduling internals arbitrarily, not
-- about hiding the opening-hours *summary* this page needs to show (the same
-- information a Google Maps listing already shows publicly). Same minimal-surface
-- pattern as the availability engine's own RPC: a narrow, read-only function that
-- returns only day_of_week/is_open/opens_at/closes_at for one tenant, never the raw
-- table. p_tenant_id is safe to accept directly (not re-derived from a session) because
-- every caller of this page already resolved that same tenant_id through the
-- already-anon-visible tenants/business_settings lookups above — this adds no new way
-- to discover a tenant_id that didn't already exist.
--
-- Granted to both anon and authenticated (unlike resolve_booking_lookup_code, anon-only):
-- "Ver como a cliente vê" (Definições) opens this same page in a new tab that still
-- carries the dona's own session cookie, so the request arrives as authenticated, not
-- anon — and opening hours are exactly as public regardless of who's asking.
create or replace function public.get_public_business_hours(p_tenant_id uuid)
returns table (day_of_week smallint, is_open boolean, opens_at time, closes_at time)
language sql
stable
security definer
set search_path = public
as $$
  select day_of_week, is_open, opens_at, closes_at
  from public.business_hours
  where tenant_id = p_tenant_id;
$$;

revoke all on function public.get_public_business_hours(uuid) from public;
grant execute on function public.get_public_business_hours(uuid) to anon;
grant execute on function public.get_public_business_hours(uuid) to authenticated;
