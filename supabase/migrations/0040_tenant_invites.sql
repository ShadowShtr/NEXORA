-- NEX-212: provisionamento de colaborador — convite por link seguro, partilhado
-- manualmente pela dona (sem SMS/e-mail pago, mesma filosofia do plano mestre).
-- Token nunca é guardado em texto (só o hash, mesmo padrão de
-- appointments.booking_token_hash, NEX-071/src/lib/booking-token-lookup.ts).

create table public.tenant_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  token_hash text not null unique,
  name text not null check (char_length(name) between 1 and 120),
  email text not null,
  role public.user_role not null check (role <> 'admin'),
  is_provider boolean not null default false,
  created_by uuid not null references public.profiles(user_id),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles(user_id),
  created_at timestamptz not null default now()
);

create index tenant_invites_tenant_idx on public.tenant_invites (tenant_id, created_at desc);

alter table public.tenant_invites enable row level security;

-- Só quem já pertence ao tenant (o dono/gestora que emitiu o convite, tipicamente) o
-- pode ler/gerir — nunca por token, isso é resolvido server-side com o service role
-- (mesmo padrão de bookings/booking_token_hash: um visitante sem sessão nunca consulta
-- esta tabela diretamente via RLS).
create policy tenant_invites_select on public.tenant_invites for select to authenticated
using (tenant_id = public.current_tenant_id());
create policy tenant_invites_insert on public.tenant_invites for insert to authenticated
with check (tenant_id = public.current_tenant_id());
create policy tenant_invites_update on public.tenant_invites for update to authenticated
using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id());
create policy tenant_invites_delete on public.tenant_invites for delete to authenticated
using (tenant_id = public.current_tenant_id());
