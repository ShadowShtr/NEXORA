-- NEX-060: model the "horário especial" concept from docs/01_PRODUCT_REQUIREMENTS.md
-- (§"Dona pode criar horário especial") — a specific calendar date whose hours replace
-- the recurring weekly pattern in business_hours (0001_initial.sql) for that date only.
--
-- Distinct from availability_blocks (0001_initial.sql), which carves out unavailable
-- time within/around otherwise-normal hours (ad-hoc "bloqueios", multi-day "férias" via
-- is_all_day) without touching the concept of what the normal schedule *is*. An
-- exception row instead redefines that schedule for one date — it can be more
-- restrictive (closed for a holiday), less restrictive (extended hours), or just
-- different (no lunch break that day). The availability engine (NEX-061/062) is
-- expected to prefer this row over business_hours for the matching date, then still
-- subtract any overlapping availability_blocks on top.
--
-- Mirrors business_hours' shape/constraints exactly (same open/lunch validation, same
-- lack of created_at/updated_at — both are small config-like tables replaced wholesale
-- rather than tracked field-by-field) so the two stay easy to reason about together.
create table public.business_hours_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  exception_date date not null,
  is_open boolean not null default false,
  opens_at time,
  closes_at time,
  lunch_starts_at time,
  lunch_ends_at time,
  reason text,
  check ((not is_open) or (opens_at is not null and closes_at is not null and opens_at < closes_at)),
  check ((lunch_starts_at is null and lunch_ends_at is null) or (lunch_starts_at < lunch_ends_at)),
  unique (tenant_id, exception_date)
);

alter table public.business_hours_exceptions enable row level security;

-- Same tenant-scoped authenticated CRUD shape as the "ordinary tables" loop in
-- 0001_initial.sql — written out directly since that loop already ran and 0001 is
-- immutable (NEX-011 convention, see 0002_harden_tenant_fk_integrity.sql). No anon
-- policy: like business_hours, the raw schedule is never exposed to the public booking
-- page directly — only computed available slots will be, via a security definer
-- function in a later task (NEX-061/062), matching ADR-008.
create policy business_hours_exceptions_select on public.business_hours_exceptions for select to authenticated
using (tenant_id = public.current_tenant_id());
create policy business_hours_exceptions_insert on public.business_hours_exceptions for insert to authenticated
with check (tenant_id = public.current_tenant_id());
create policy business_hours_exceptions_update on public.business_hours_exceptions for update to authenticated
using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
create policy business_hours_exceptions_delete on public.business_hours_exceptions for delete to authenticated
using (tenant_id = public.current_tenant_id());
