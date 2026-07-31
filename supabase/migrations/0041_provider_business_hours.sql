-- NEX-213: horários por prestador — mesma forma/constraints de business_hours e
-- business_hours_exceptions (0001_initial.sql/0006_business_hours_exceptions.sql),
-- agora por service_providers.id em vez de por tenant inteiro. "Prestador sem horário
-- próprio herda o horário do negócio por omissão" é resolvido em código
-- (src/features/appointments/domain/provider-schedule.ts), não aqui: a ausência de
-- qualquer linha em provider_business_hours para um prestador é o sinal de "sem
-- horário próprio definido", não uma linha extra a criar.

create table public.provider_business_hours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider_id uuid not null references public.service_providers(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  is_open boolean not null default false,
  opens_at time,
  closes_at time,
  lunch_starts_at time,
  lunch_ends_at time,
  check ((not is_open) or (opens_at is not null and closes_at is not null and opens_at < closes_at)),
  check ((lunch_starts_at is null and lunch_ends_at is null) or (lunch_starts_at < lunch_ends_at)),
  unique (provider_id, day_of_week)
);

create table public.provider_business_hours_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider_id uuid not null references public.service_providers(id) on delete cascade,
  exception_date date not null,
  is_open boolean not null default false,
  opens_at time,
  closes_at time,
  lunch_starts_at time,
  lunch_ends_at time,
  reason text,
  check ((not is_open) or (opens_at is not null and closes_at is not null and opens_at < closes_at)),
  check ((lunch_starts_at is null and lunch_ends_at is null) or (lunch_starts_at < lunch_ends_at)),
  unique (provider_id, exception_date)
);

-- "Bloqueios, férias" por prestador: extensão em vez de tabela nova — a mesma
-- availability_blocks (0001_initial.sql) que já modela isto ao nível do tenant, agora
-- com um provider_id opcional. NULL continua a significar "bloqueia o tenant inteiro"
-- (comportamento já existente, inalterado); preenchido restringe o bloqueio só à
-- agenda desse prestador.
alter table public.availability_blocks
  add column provider_id uuid references public.service_providers(id) on delete cascade;

create index availability_blocks_provider_idx
  on public.availability_blocks (provider_id) where provider_id is not null;

alter table public.provider_business_hours enable row level security;
alter table public.provider_business_hours_exceptions enable row level security;

create policy provider_business_hours_select on public.provider_business_hours for select to authenticated
using (tenant_id = public.current_tenant_id());
create policy provider_business_hours_insert on public.provider_business_hours for insert to authenticated
with check (tenant_id = public.current_tenant_id());
create policy provider_business_hours_update on public.provider_business_hours for update to authenticated
using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
create policy provider_business_hours_delete on public.provider_business_hours for delete to authenticated
using (tenant_id = public.current_tenant_id());

create policy provider_business_hours_exceptions_select on public.provider_business_hours_exceptions for select to authenticated
using (tenant_id = public.current_tenant_id());
create policy provider_business_hours_exceptions_insert on public.provider_business_hours_exceptions for insert to authenticated
with check (tenant_id = public.current_tenant_id());
create policy provider_business_hours_exceptions_update on public.provider_business_hours_exceptions for update to authenticated
using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
create policy provider_business_hours_exceptions_delete on public.provider_business_hours_exceptions for delete to authenticated
using (tenant_id = public.current_tenant_id());
