-- NEX-215: salas e equipamentos, e a mudança de constraint que os torna significativos
-- — "a reserva impede conflito de prestador e de recurso" exige que a exclusão de
-- sobreposição (appointments_no_overlap, 0001_initial.sql) deixe de ser só
-- tenant-wide.
--
-- localização: ainda não existe uma tabela `locations` (EPIC-27, multi-localização,
-- não implementado) — campo de texto livre por agora, não uma FK para uma tabela que
-- não existe.

create type public.resource_type as enum ('room', 'equipment', 'chair', 'other');

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  type public.resource_type not null,
  capacity integer check (capacity is null or capacity > 0),
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  location text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resource_services (
  resource_id uuid not null references public.resources(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  primary key (resource_id, service_id)
);

create or replace function public.resource_services_same_tenant()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.resources where id = new.resource_id and tenant_id = new.tenant_id
  ) then
    raise exception 'resource_id must belong to the same tenant' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.services where id = new.service_id and tenant_id = new.tenant_id
  ) then
    raise exception 'service_id must belong to the same tenant' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger resource_services_same_tenant_trigger
  before insert or update on public.resource_services
  for each row execute function public.resource_services_same_tenant();

alter table public.resources enable row level security;
alter table public.resource_services enable row level security;

create policy resources_select on public.resources for select to authenticated
using (tenant_id = public.current_tenant_id());
create policy resources_insert on public.resources for insert to authenticated
with check (tenant_id = public.current_tenant_id());
create policy resources_update on public.resources for update to authenticated
using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
create policy resources_delete on public.resources for delete to authenticated
using (tenant_id = public.current_tenant_id());

create policy resource_services_select on public.resource_services for select to authenticated
using (tenant_id = public.current_tenant_id());
create policy resource_services_insert on public.resource_services for insert to authenticated
with check (tenant_id = public.current_tenant_id());
create policy resource_services_update on public.resource_services for update to authenticated
using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
create policy resource_services_delete on public.resource_services for delete to authenticated
using (tenant_id = public.current_tenant_id());

-- Marcação pode agora referenciar (opcionalmente) um prestador e/ou um recurso.
alter table public.appointments
  add column provider_id uuid references public.service_providers(id) on delete restrict,
  add column resource_id uuid references public.resources(id) on delete restrict;

-- appointments_no_overlap (0001_initial.sql) era tenant-wide — correto só enquanto
-- existir um único prestador implícito por tenant. Substituída por três exclusões
-- distintas, cada uma cobrindo exatamente um "recurso partilhado" que não pode estar
-- em dois lados ao mesmo tempo:
--
-- 1. provider_id preenchido: o MESMO prestador não pode ter duas marcações a
--    sobrepor-se (dois prestadores diferentes já não colidem entre si — é
--    literalmente o ponto de ter vários prestadores).
-- 2. resource_id preenchido: o MESMO recurso (sala/equipamento/cadeira) não pode ter
--    duas marcações a sobrepor-se, independentemente do prestador.
-- 3. nem provider_id nem resource_id preenchidos: comportamento tenant-wide de hoje,
--    inalterado — o caso de uma profissional independente sem equipa, ou de uma
--    marcação ainda sem prestador/recurso atribuído.
--
-- Uma marcação com provider_id E resource_id preenchidos fica protegida pelas duas
-- primeiras em simultâneo (cada exclusão avalia-a independentemente).
alter table public.appointments drop constraint appointments_no_overlap;

alter table public.appointments add constraint appointments_no_overlap_provider
exclude using gist (
  provider_id with =,
  tstzrange(start_at, blocked_until, '[)') with &&
) where (status in ('confirmed', 'presence_confirmed') and provider_id is not null);

alter table public.appointments add constraint appointments_no_overlap_resource
exclude using gist (
  resource_id with =,
  tstzrange(start_at, blocked_until, '[)') with &&
) where (status in ('confirmed', 'presence_confirmed') and resource_id is not null);

alter table public.appointments add constraint appointments_no_overlap_tenant_wide
exclude using gist (
  tenant_id with =,
  tstzrange(start_at, blocked_until, '[)') with &&
) where (
  status in ('confirmed', 'presence_confirmed')
  and provider_id is null
  and resource_id is null
);

-- Um prestador/recurso associado a uma marcação tem de pertencer ao mesmo tenant —
-- mesma garantia que service_providers/provider_services/resource_services já reforçam
-- em SQL, agora para o par marcação/prestador/recurso.
create or replace function public.appointments_provider_resource_same_tenant()
returns trigger
language plpgsql
as $$
begin
  if new.provider_id is not null and not exists (
    select 1 from public.service_providers where id = new.provider_id and tenant_id = new.tenant_id
  ) then
    raise exception 'provider_id must belong to the same tenant' using errcode = '23514';
  end if;
  if new.resource_id is not null and not exists (
    select 1 from public.resources where id = new.resource_id and tenant_id = new.tenant_id
  ) then
    raise exception 'resource_id must belong to the same tenant' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger appointments_provider_resource_same_tenant_trigger
  before insert or update on public.appointments
  for each row execute function public.appointments_provider_resource_same_tenant();
