-- NEX-011: harden 0001_initial.sql without editing it (accepted migrations are immutable).
--
-- 1) Cross-tenant referential integrity: several foreign keys between tenant-scoped
--    tables only guaranteed the referenced row existed *somewhere*, not that it belonged
--    to the same tenant as the referencing row. RLS insert/update policies check the
--    referencing row's own tenant_id, but never validated that a referenced id (e.g.
--    appointments.client_id) actually belongs to that tenant. A bug or a service-role
--    script could otherwise link tenant A's appointment to tenant B's client. Composite
--    foreign keys on (tenant_id, id) make this structurally impossible, as defense in
--    depth beyond RLS.
-- 2) Missing indexes on foreign-key columns: Postgres does not auto-index FK columns
--    (only primary keys get one). Several are hit by expected query patterns (services by
--    category, appointment items/payments by appointment, client photos by client).
-- 3) Two financial/data invariants missing from 0001: appointment_items.source_id must be
--    present for service/package lines, and unit_price_cents sign must match source_type
--    (discounts negative, everything else non-negative).

-- 1) Composite uniqueness needed as the target of composite foreign keys below.
alter table public.service_categories add constraint service_categories_tenant_id_id_key unique (tenant_id, id);
alter table public.services add constraint services_tenant_id_id_key unique (tenant_id, id);
alter table public.packages add constraint packages_tenant_id_id_key unique (tenant_id, id);
alter table public.clients add constraint clients_tenant_id_id_key unique (tenant_id, id);
alter table public.recurring_series add constraint recurring_series_tenant_id_id_key unique (tenant_id, id);
alter table public.appointments add constraint appointments_tenant_id_id_key unique (tenant_id, id);

-- 2) Replace single-column FKs with tenant-scoped composite FKs.
alter table public.services
  drop constraint services_category_id_fkey,
  add constraint services_tenant_category_fkey
    foreign key (tenant_id, category_id) references public.service_categories (tenant_id, id) on delete restrict;

alter table public.package_services
  drop constraint package_services_package_id_fkey,
  add constraint package_services_tenant_package_fkey
    foreign key (tenant_id, package_id) references public.packages (tenant_id, id) on delete cascade,
  drop constraint package_services_service_id_fkey,
  add constraint package_services_tenant_service_fkey
    foreign key (tenant_id, service_id) references public.services (tenant_id, id) on delete restrict;

alter table public.recurring_series
  drop constraint recurring_series_client_id_fkey,
  add constraint recurring_series_tenant_client_fkey
    foreign key (tenant_id, client_id) references public.clients (tenant_id, id) on delete cascade;

alter table public.appointments
  drop constraint appointments_client_id_fkey,
  add constraint appointments_tenant_client_fkey
    foreign key (tenant_id, client_id) references public.clients (tenant_id, id) on delete restrict,
  drop constraint appointments_recurring_series_id_fkey,
  add constraint appointments_tenant_recurring_series_fkey
    foreign key (tenant_id, recurring_series_id) references public.recurring_series (tenant_id, id) on delete set null;

alter table public.appointment_items
  drop constraint appointment_items_appointment_id_fkey,
  add constraint appointment_items_tenant_appointment_fkey
    foreign key (tenant_id, appointment_id) references public.appointments (tenant_id, id) on delete cascade;

alter table public.payments
  drop constraint payments_appointment_id_fkey,
  add constraint payments_tenant_appointment_fkey
    foreign key (tenant_id, appointment_id) references public.appointments (tenant_id, id) on delete cascade;

alter table public.reminders
  drop constraint reminders_appointment_id_fkey,
  add constraint reminders_tenant_appointment_fkey
    foreign key (tenant_id, appointment_id) references public.appointments (tenant_id, id) on delete cascade;

alter table public.client_photos
  drop constraint client_photos_client_id_fkey,
  add constraint client_photos_tenant_client_fkey
    foreign key (tenant_id, client_id) references public.clients (tenant_id, id) on delete cascade,
  drop constraint client_photos_appointment_id_fkey,
  add constraint client_photos_tenant_appointment_fkey
    foreign key (tenant_id, appointment_id) references public.appointments (tenant_id, id) on delete set null;

-- appointment_items.source_id stays polymorphic (service_id or package_id depending on
-- source_type) and intentionally has no foreign key — Postgres cannot express a
-- conditional FK across two target tables. Presence is enforced by the check constraint
-- below instead; the referenced row's tenant is validated at the application boundary
-- when the item is created.
comment on column public.appointment_items.source_id is
  'Polymorphic reference to services.id or packages.id depending on source_type. No FK by design (conditional target); validated at the application boundary.';

-- 3) Financial/data invariants missing from 0001.
alter table public.appointment_items
  add constraint appointment_items_source_id_presence
  check (
    (source_type in ('service', 'package') and source_id is not null)
    or (source_type in ('manual_extra', 'discount'))
  );

alter table public.appointment_items
  add constraint appointment_items_price_sign
  check (
    (source_type = 'discount' and unit_price_cents <= 0)
    or (source_type <> 'discount' and unit_price_cents >= 0)
  );

-- 4) Missing indexes on foreign-key / expected filter columns.
create index services_category_idx on public.services (tenant_id, category_id);
create index package_services_service_idx on public.package_services (tenant_id, service_id);
create index recurring_series_tenant_client_idx on public.recurring_series (tenant_id, client_id);
create index appointments_recurring_series_idx on public.appointments (tenant_id, recurring_series_id)
  where recurring_series_id is not null;
create index appointment_items_appointment_idx on public.appointment_items (tenant_id, appointment_id);
create index payments_appointment_idx on public.payments (tenant_id, appointment_id);
create index payments_tenant_status_idx on public.payments (tenant_id, status);
create index availability_blocks_tenant_range_idx on public.availability_blocks (tenant_id, starts_at, ends_at);
create index client_photos_client_idx on public.client_photos (tenant_id, client_id);

-- 5) updated_at was documented as maintained by the application, which is easy to forget
-- on a given UPDATE call site. Enforce it at the database level instead.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.business_settings
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.services
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.packages
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
