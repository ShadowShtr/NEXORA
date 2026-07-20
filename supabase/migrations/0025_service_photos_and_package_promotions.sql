-- Service photo: an optional menu-style thumbnail the owner picks for a service, shown
-- on the public booking page (/b/[slug]/servicos). Distinct from client_photos
-- (NEX-094, 0019_client_photos_storage.sql) — that table is private "fotografias
-- internas dos trabalhos" tied to a specific client's history
-- (docs/01_PRODUCT_REQUIREMENTS.md #10), and that same section's "não existe
-- portefólio público no MVP" is about not exposing that client-history gallery
-- publicly. A service's own catalog photo is not that — it is meant to be public, the
-- same way its name and price already are.
alter table public.services add column photo_path text;

-- Package promotion: an optional "before" price. When set, the public page shows
-- price_cents as a discounted price against it; the discount percentage is always
-- derived from the two prices at render time (src/features/catalog/domain/package.ts),
-- never stored, so it can never drift out of sync with the actual prices.
alter table public.packages add column compare_at_price_cents bigint;
alter table public.packages
  add constraint packages_compare_at_price_check
  check (compare_at_price_cents is null or compare_at_price_cents > price_cents);

-- Public bucket (unlike client-photos): the public booking page has no session, so a
-- visitor needs to load these without auth. file_size_limit/allowed_mime_types mirror
-- 0019_client_photos_storage.sql; the upload action re-encodes every accepted file to
-- JPEG via sharp (src/lib/image-processing.ts) before it ever reaches Storage, same
-- EXIF-strip + signature-check reasoning as the client-photos bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-photos', 'service-photos', true, 8388608, array['image/jpeg'])
on conflict (id) do nothing;

-- Object path convention: {tenant_id}/{service_id}/{uuid}.jpg — a public bucket serves
-- reads through the public URL endpoint without going through RLS at all, so this select
-- policy only matters for direct table/API access, not the public page's <img> tags.
create policy service_photos_storage_select on storage.objects for select
using (bucket_id = 'service-photos');

create policy service_photos_storage_insert on storage.objects for insert to authenticated
with check (bucket_id = 'service-photos' and (storage.foldername(name))[1] = public.current_tenant_id()::text);

create policy service_photos_storage_delete on storage.objects for delete to authenticated
using (bucket_id = 'service-photos' and (storage.foldername(name))[1] = public.current_tenant_id()::text);
