-- NEXORA initial multi-tenant schema.
-- Review and test locally before applying to any shared environment.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.tenant_status as enum ('setup', 'active', 'suspended', 'deleted');
create type public.user_role as enum ('owner', 'admin');
create type public.appointment_status as enum ('confirmed', 'presence_confirmed', 'completed', 'cancelled', 'no_show');
create type public.payment_method as enum ('cash', 'mbway');
create type public.payment_status as enum ('pending', 'paid', 'refunded');
create type public.reminder_status as enum ('pending', 'opened', 'marked_sent', 'skipped');
create type public.booking_source as enum ('public', 'admin', 'recurring');

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  status public.tenant_status not null default 'setup',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role public.user_role not null default 'owner',
  display_name text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table public.business_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  professional_name text not null default '',
  phone_e164 text,
  email text,
  address_line text,
  postal_code text,
  locality text,
  maps_url text,
  timezone text not null default 'Europe/Lisbon',
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes in (15, 30, 60)),
  buffer_minutes integer not null default 15 check (buffer_minutes in (5, 10, 15, 30)),
  min_notice_hours integer not null default 3 check (min_notice_hours in (1, 2, 3, 6, 12, 24)),
  booking_window_days integer not null default 60 check (booking_window_days in (15, 30, 60, 90, 180)),
  cancellation_notice_hours integer not null default 24 check (cancellation_notice_hours in (6, 12, 24, 48)),
  reminder_hours integer not null default 24 check (reminder_hours = 24),
  onboarding_step integer not null default 1 check (onboarding_step between 1 and 5),
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_open boolean not null default false,
  opens_at time,
  closes_at time,
  lunch_starts_at time,
  lunch_ends_at time,
  check ((not is_open) or (opens_at is not null and closes_at is not null and opens_at < closes_at)),
  check ((lunch_starts_at is null and lunch_ends_at is null) or (lunch_starts_at < lunch_ends_at)),
  unique (tenant_id, day_of_week)
);

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category_id uuid not null references public.service_categories(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  price_cents bigint not null check (price_cents >= 0),
  duration_minutes integer not null check (duration_minutes between 5 and 720),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  price_cents bigint not null check (price_cents >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.package_services (
  package_id uuid not null references public.packages(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  primary key (package_id, service_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  email text,
  private_notes text,
  preferences jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, phone_e164)
);

create table public.recurring_series (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'three_weeks', 'monthly', 'custom')),
  interval_value integer not null default 1 check (interval_value between 1 and 52),
  occurrence_count integer not null check (occurrence_count between 2 and 52),
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  recurring_series_id uuid references public.recurring_series(id) on delete set null,
  source public.booking_source not null,
  status public.appointment_status not null default 'confirmed',
  start_at timestamptz not null,
  end_at timestamptz not null,
  blocked_until timestamptz not null,
  expected_total_cents bigint not null check (expected_total_cents >= 0),
  final_total_cents bigint check (final_total_cents is null or final_total_cents >= 0),
  client_observation text,
  booking_token_hash text not null unique check (char_length(booking_token_hash) = 64),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_at < end_at and end_at <= blocked_until)
);

alter table public.appointments add constraint appointments_no_overlap
exclude using gist (
  tenant_id with =,
  tstzrange(start_at, blocked_until, '[)') with &&
) where (status in ('confirmed', 'presence_confirmed'));

create table public.appointment_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  source_type text not null check (source_type in ('service', 'package', 'manual_extra', 'discount')),
  source_id uuid,
  description text not null,
  unit_price_cents bigint not null,
  duration_minutes integer not null default 0 check (duration_minutes between 0 and 720),
  quantity integer not null default 1 check (quantity between 1 and 50),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  method public.payment_method,
  status public.payment_status not null default 'pending',
  amount_cents bigint not null check (amount_cents >= 0),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'pending' and method is null and paid_at is null) or (status <> 'pending' and method is not null))
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  due_at timestamptz not null,
  status public.reminder_status not null default 'pending',
  opened_at timestamptz,
  marked_sent_at timestamptz,
  unique (appointment_id)
);

create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  is_all_day boolean not null default false,
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create table public.booking_drafts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  resume_token_hash text not null unique check (char_length(resume_token_hash) = 64),
  encrypted_payload text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at <= created_at + interval '24 hours')
);

create table public.client_photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  storage_path text not null,
  kind text not null check (kind in ('before', 'after', 'other')),
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid references public.tenants(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index appointments_tenant_start_idx on public.appointments (tenant_id, start_at);
create index appointments_client_start_idx on public.appointments (client_id, start_at desc);
create index services_catalog_idx on public.services (tenant_id, is_active, sort_order);
create index reminders_due_idx on public.reminders (tenant_id, due_at, status);
create index audit_logs_tenant_time_idx on public.audit_logs (tenant_id, created_at desc);
create index booking_drafts_expiry_idx on public.booking_drafts (expires_at);

create or replace function public.current_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.tenant_id from public.profiles p where p.user_id = auth.uid()
$$;

revoke all on function public.current_tenant_id() from public;
grant execute on function public.current_tenant_id() to authenticated;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.business_settings enable row level security;
alter table public.business_hours enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.packages enable row level security;
alter table public.package_services enable row level security;
alter table public.clients enable row level security;
alter table public.recurring_series enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_items enable row level security;
alter table public.payments enable row level security;
alter table public.reminders enable row level security;
alter table public.availability_blocks enable row level security;
alter table public.booking_drafts enable row level security;
alter table public.client_photos enable row level security;
alter table public.audit_logs enable row level security;

-- Tenant-scoped authenticated policies. Public booking writes must use a narrowly scoped server RPC.
create policy tenant_read_self on public.tenants for select to authenticated
using (id = public.current_tenant_id());

create policy profile_read_self on public.profiles for select to authenticated
using (user_id = auth.uid());

-- Generate consistent tenant policies for ordinary tables.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'business_settings','business_hours','service_categories','services','packages',
    'package_services','clients','recurring_series','appointments','appointment_items',
    'payments','reminders','availability_blocks','client_photos'
  ] loop
    execute format('create policy %I_select on public.%I for select to authenticated using (tenant_id = public.current_tenant_id())', table_name, table_name);
    execute format('create policy %I_insert on public.%I for insert to authenticated with check (tenant_id = public.current_tenant_id())', table_name, table_name);
    execute format('create policy %I_update on public.%I for update to authenticated using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id())', table_name, table_name);
    execute format('create policy %I_delete on public.%I for delete to authenticated using (tenant_id = public.current_tenant_id())', table_name, table_name);
  end loop;
end $$;

-- Drafts and audit logs are server-managed; no direct authenticated mutation policy by default.
create policy booking_drafts_select on public.booking_drafts for select to authenticated
using (tenant_id = public.current_tenant_id());
create policy audit_logs_select on public.audit_logs for select to authenticated
using (tenant_id = public.current_tenant_id());

-- Public catalog read policies expose only active/published business data. Consider replacing with views/RPC in NEX-026.
create policy public_tenant_lookup on public.tenants for select to anon
using (status = 'active');
create policy public_business_settings on public.business_settings for select to anon
using (published_at is not null);
create policy public_categories on public.service_categories for select to anon
using (is_visible = true);
create policy public_services on public.services for select to anon
using (is_active = true);
create policy public_packages on public.packages for select to anon
using (is_active = true);
create policy public_package_services on public.package_services for select to anon
using (true);

-- No anon policies for clients, appointments, payments, reminders, photos or audit logs.
