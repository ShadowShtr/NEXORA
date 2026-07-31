-- NEX-214: relação N:N prestador-serviço — preço/duração opcionais (override),
-- ativo e prioridade. Sem override, o preço/duração do serviço base aplicam-se
-- (resolvido em código, src/features/appointments/domain/provider-service.ts — a mesma
-- filosofia "ausência de override é o sinal de usar o valor base" de NEX-213).

create table public.provider_services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider_id uuid not null references public.service_providers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  price_cents bigint check (price_cents is null or price_cents >= 0),
  duration_minutes integer check (duration_minutes is null or duration_minutes between 5 and 720),
  is_active boolean not null default true,
  priority integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, service_id)
);

create index provider_services_provider_idx
  on public.provider_services (provider_id, priority);
create index provider_services_service_idx
  on public.provider_services (service_id);

-- Mesma garantia de "mesmo tenant" que service_providers já reforça em SQL
-- (0039_tenant_members_and_providers.sql) — aqui para o par provider/service.
create or replace function public.provider_services_same_tenant()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.service_providers
    where id = new.provider_id and tenant_id = new.tenant_id
  ) then
    raise exception 'provider_id must belong to the same tenant' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.services
    where id = new.service_id and tenant_id = new.tenant_id
  ) then
    raise exception 'service_id must belong to the same tenant' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger provider_services_same_tenant_trigger
  before insert or update on public.provider_services
  for each row execute function public.provider_services_same_tenant();

alter table public.provider_services enable row level security;

create policy provider_services_select on public.provider_services for select to authenticated
using (tenant_id = public.current_tenant_id());
create policy provider_services_insert on public.provider_services for insert to authenticated
with check (tenant_id = public.current_tenant_id());
create policy provider_services_update on public.provider_services for update to authenticated
using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
create policy provider_services_delete on public.provider_services for delete to authenticated
using (tenant_id = public.current_tenant_id());
