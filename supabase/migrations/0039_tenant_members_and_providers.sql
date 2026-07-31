-- NEX-210: modelo de membros, prestadores e roles (EPIC-19).
--
-- ADR-011: `public.profiles` já é, estruturalmente, a tabela de "membros do
-- tenant" que o plano mestre pede como `tenant_members` — um utilizador
-- pertence a exatamente um tenant, com um role (0001_initial.sql). Em vez de
-- criar uma tabela paralela (duas fontes da verdade para a mesma relação),
-- esta migração estende `profiles` no local: novos valores de role, e um
-- estado ativo/inativo. `public.current_tenant_id()` (a base de toda a RLS
-- do schema) e `requireProfile()` continuam inalterados.
--
-- `service_providers` é uma tabela nova e separada, opcional — nem todo
-- membro é prestador ("rececionista não conta como prestador").

-- Novos roles. `admin` fica como valor legado nunca atribuído (recriar o
-- tipo para o remover seria um risco desproporcional para uma limpeza
-- cosmética — ver ADR-011). Não é seguro usar um valor de enum na mesma
-- transação em que é adicionado, por isso estes ALTER TYPE ficam sozinhos,
-- sem nenhuma linha desta migração a atribuir 'manager'/'receptionist'/
-- 'provider'/'viewer' a ninguém.
alter type public.user_role add value if not exists 'manager';
alter type public.user_role add value if not exists 'receptionist';
alter type public.user_role add value if not exists 'provider';
alter type public.user_role add value if not exists 'viewer';

-- "conta desativada perde sessão" — checado em requireProfile()/getOptionalProfile(),
-- não pela RLS (uma conta inativa continua a poder ser lida pela própria dona/gestor
-- para ser reativada; o que muda é a aplicação recusar a sessão, não o acesso à linha).
alter table public.profiles add column is_active boolean not null default true;

create type public.provider_status as enum ('active', 'inactive');

create table public.service_providers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  member_user_id uuid not null references public.profiles(user_id) on delete cascade,
  status public.provider_status not null default 'active',
  color text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  booking_enabled boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, member_user_id)
);

create index service_providers_tenant_order_idx
  on public.service_providers (tenant_id, display_order);

-- Um prestador só pode ser membro do mesmo tenant, nunca de outro — reforça em SQL a
-- mesma garantia que a RLS já dá, útil sobretudo para o RPC de provisionamento (NEX-212)
-- que vai correr como security definer.
create or replace function public.service_providers_member_same_tenant()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1 from public.profiles
    where user_id = new.member_user_id and tenant_id = new.tenant_id
  ) then
    raise exception 'member_user_id must belong to the same tenant' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger service_providers_member_same_tenant_trigger
  before insert or update on public.service_providers
  for each row execute function public.service_providers_member_same_tenant();

alter table public.service_providers enable row level security;

create policy service_providers_select on public.service_providers for select to authenticated
using (tenant_id = public.current_tenant_id());
create policy service_providers_insert on public.service_providers for insert to authenticated
with check (tenant_id = public.current_tenant_id());
create policy service_providers_update on public.service_providers for update to authenticated
using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
create policy service_providers_delete on public.service_providers for delete to authenticated
using (tenant_id = public.current_tenant_id());

-- "Owner único não pode remover-se a si próprio": aplicado num RPC dedicado, não numa
-- constraint de tabela (uma constraint não consegue expressar "o único owner ativo
-- restante"), para ser reutilizável tanto pela remoção como pela mudança de role de um
-- owner para outra coisa — ambas violam a mesma regra da mesma forma.
create or replace function public.assert_not_last_owner(p_tenant_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_owner boolean;
  v_other_active_owners integer;
begin
  select role = 'owner' and is_active into v_is_owner
  from public.profiles
  where user_id = p_user_id and tenant_id = p_tenant_id;

  if not coalesce(v_is_owner, false) then
    return;
  end if;

  select count(*) into v_other_active_owners
  from public.profiles
  where tenant_id = p_tenant_id
    and role = 'owner'
    and is_active
    and user_id <> p_user_id;

  if v_other_active_owners = 0 then
    raise exception 'cannot remove or demote the tenant''s only active owner' using errcode = '23514';
  end if;
end;
$$;

revoke all on function public.assert_not_last_owner(uuid, uuid) from public;
revoke all on function public.assert_not_last_owner(uuid, uuid) from anon;
grant execute on function public.assert_not_last_owner(uuid, uuid) to authenticated;
