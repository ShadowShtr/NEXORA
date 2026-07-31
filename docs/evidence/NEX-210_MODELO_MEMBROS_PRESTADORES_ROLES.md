# NEX-210 — Modelo de membros, prestadores e roles

## Objetivo

Modelar equipas (vários membros por tenant, com role) e prestadores
(subconjunto de membros que ocupam agenda), abrindo caminho para o resto do
`EPIC-19`.

## Decisão de arquitetura

`public.profiles` já era, estruturalmente, a tabela de membros do tenant
(`user_id` + `tenant_id` + `role`, `0001_initial.sql`) — e
`public.current_tenant_id()`, a base de toda a RLS do schema, lê o tenant
diretamente dela. Criar uma `tenant_members` nova e paralela (como o plano
mestre sugeria, sem conhecimento do schema real) duplicaria essa relação em
duas tabelas. Documentado em `docs/adr/ADR-011-tenant-members-extends-profiles.md`:
estender `profiles` no local, sem tocar em `current_tenant_id()` nem nos
dezenas de call sites de `requireProfile()`.

## Implementação

`supabase/migrations/0039_tenant_members_and_providers.sql`:

- `user_role` ganha `manager`, `receptionist`, `provider`, `viewer` (o valor
  `admin` existente nunca foi atribuído a ninguém — fica como legado
  depreciado, documentado no ADR; recriar o enum para o remover seria um
  risco desproporcional para uma limpeza cosmética).
- `profiles.is_active boolean not null default true` — "conta desativada
  perde sessão".
- `service_providers` (tabela nova, separada e opcional): `tenant_id`,
  `member_user_id` (referencia `profiles.user_id`), `status`
  (`provider_status` enum, `active`/`inactive`), `color` (hex validado por
  `check`), `booking_enabled`, `display_order`. `unique(tenant_id,
member_user_id)` — um prestador por membro. Trigger
  `service_providers_member_same_tenant` impede associar um membro de outro
  tenant (redundante com a RLS, mas reforça a garantia ao nível do RPC de
  provisionamento que `NEX-212` vai construir por cima). RLS tenant-scoped
  padrão (select/insert/update/delete).
- `assert_not_last_owner(p_tenant_id, p_user_id)`: RPC que levanta exceção
  se `p_user_id` for o único owner ativo do tenant — reutilizável tanto por
  "remover membro" como por "mudar role de owner para outra coisa" (`NEX-212`/
  `217`), já que ambas violam a mesma regra da mesma forma. No-op para
  quem não é owner ativo.

`src/lib/auth/require-profile.ts`: `requireProfile()`/`getOptionalProfile()`
passam a ler `role`/`is_active` e a devolver `role` — primeiro consumidor
real da coluna `role`, que já existia mas nunca era lida em código nenhum.
Conta inativa é agora rejeitada no mesmo ponto de autorização que já corre
em toda a página autenticada, sem duplicar a verificação por funcionalidade.

## Testes

- `tests/integration/tenant-members-roles.test.ts` (novo): aceita cada um
  dos 5 roles; confirma que um membro pode existir sem ser prestador;
  cria/valida `service_providers` com defaults corretos; rejeita associar
  um membro de outro tenant (trigger); rejeita cor inválida;
  `assert_not_last_owner` — levanta para o único owner ativo, no-op quando
  há outro owner, no-op para não-owner, no-op para owner já inativo.
- `tests/unit/require-profile.test.ts`: atualizado (mock de perfil agora
  inclui `role`/`is_active`) e um teste novo para a sessão terminada quando
  a conta está inativa.

## Estado real desta tarefa — limitação de verificação local

**Não foi possível aplicar esta migração a nenhum Postgres real nesta
sessão** — nem via `supabase start` (Docker não funciona nesta máquina,
`ADR-007`) nem via `supabase db push --db-url` (exigiria a password direta
da base de dados, que este ambiente não tem — só a URL da API REST e as
chaves anon/service role, credenciais diferentes). Corri
`tests/integration/tenant-members-roles.test.ts` contra o Supabase de
dev/preview partilhado só para confirmar a _lógica_ dos testes — falharam
todos, exatamente como esperado (`"invalid input value for enum user_role"`,
`"function ... not found"`, tabela não encontrada), porque essa migração
ainda não existe lá. Isto **não é um sinal de bug** — é a confirmação de que
o teste está a verificar as coisas certas, só ainda sem o schema aplicado.

A validação real desta migração acontece no job `integration` do CI
(`.github/workflows/ci.yml`) — já um check obrigatório na proteção de
branch, já correndo `supabase start` com sucesso em Docker nativo no
runner (`NEX-178`), que aplica todas as migrações do zero a cada execução.
Diferente de `NEX-173`/`NEX-203`: não depende de nenhum secret novo nem de
ação manual da dona — é o mesmo gate que já protege todos os PRs.
`npm run verify` (format/lint/typecheck/testes unitários/build) passa
localmente; os testes de integração deste ficheiro só correm de facto (e
só então provam algo) quando o CI os correr contra o seu próprio Postgres
efémero.

## Definition of Done

- [x] Implementação concluída — migração, `require-profile.ts`, ADR-011
- [ ] Testes concluídos — lógica escrita e revista; execução real pendente do job `integration` do CI (não corre neste ambiente sem Docker)
- [x] Documentação atualizada
- [x] Critérios de aceite validados (por revisão de código; confirmação final pelo CI)
- [x] Tarefa marcada no `TASKS.md`
