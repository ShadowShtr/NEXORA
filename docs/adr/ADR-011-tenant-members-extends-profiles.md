# ADR-011 — Equipa/prestadores estende `profiles`, não cria `tenant_members` paralela

## Estado

Aceite

## Contexto

O plano mestre de expansão (`NEXORA_PLANO_MESTRE_CONSTRUCAO_UI_SEM_CUSTOS.md`,
`EPIC-19`/`NEX-210`) pede a criação de uma tabela `tenant_members` para
modelar equipas (vários utilizadores por tenant, com role). O plano foi
escrito sem conhecimento do schema real já existente: `public.profiles`
(`0001_initial.sql`) já é, estruturalmente, exatamente essa tabela —
`user_id` (chave primária, `references auth.users`), `tenant_id`, `role`
(`public.user_role`, hoje só `owner`/`admin`, o segundo nunca usado),
`display_name`. Mais importante: **`public.current_tenant_id()` — a função
`security definer` da qual depende a política RLS de every tabela
tenant-scoped no schema — lê `tenant_id` diretamente de `profiles` por
`user_id = auth.uid()`**. `requireProfile()` (`src/lib/auth/require-profile.ts`)
é chamado por praticamente toda página autenticada do dashboard.

Criar uma tabela `tenant_members` nova, paralela a `profiles`, duplicaria a
relação (utilizador, tenant, role) em duas tabelas — um risco real de
divergência (qual é a fonte da verdade quando as duas discordarem?) sem
nenhum benefício, já que o modelo pretendido (um utilizador pertence a
exatamente um tenant, com um role) é idêntico ao que `profiles` já
implementa.

## Opções

1. Criar `tenant_members` nova, paralela a `profiles`, e passar a ler role/
   estado dela em vez de `profiles` (exige duplicar ou migrar dados,
   reescrever `current_tenant_id()` e `requireProfile()`, e manter as duas
   tabelas em sincronia indefinidamente).
2. Renomear `profiles` para `tenant_members` (exige atualizar todas as
   políticas RLS, `current_tenant_id()`, `requireProfile()` e todas as
   referências a `profiles` no código e nas migrações — risco de regressão
   alto para um ganho puramente cosmético de nome).
3. **Estender `profiles` no local**: adicionar os novos valores de role
   (`manager`, `receptionist`, `provider`, `viewer`) ao enum `user_role`,
   adicionar `is_active` (conta desativada perde sessão), e criar
   `service_providers` como tabela **separada e opcional** (nem todo membro
   é prestador), referenciando `profiles.user_id`. Sem tocar no nome da
   tabela nem em `current_tenant_id()`.

## Decisão

Opção 3. `profiles` já é a tabela de membros do tenant; só lhe faltavam os
roles novos e um estado ativo/inativo — estendê-la no local evita duplicar a
fonte da verdade de "quem pertence a este tenant, com que role" e não exige
tocar em `current_tenant_id()` (o alicerce de toda a RLS do schema) nem nos
dezenas de call sites de `requireProfile()`. O nome da tabela continua
`profiles` no código/schema; a documentação de produto (`docs/PERMISSION_MATRIX.md`,
`NEX-211`) usa "membro do tenant" como termo de negócio, sem exigir que o
nome da tabela mude para bater certo com o texto do plano mestre.

## Consequências positivas

- Zero mudança em `current_tenant_id()`, `requireProfile()`,
  `getOptionalProfile()` ou em qualquer política RLS já existente — o maior
  ponto único de risco deste épico fica intocado.
- Uma só fonte da verdade para (utilizador, tenant, role) — sem tabelas
  paralelas a manter em sincronia.
- `service_providers` como tabela própria, opcional, mantém a regra do
  plano ("rececionista não conta como prestador") de forma estrutural: só
  existe uma linha em `service_providers` para quem é de facto prestador.

## Consequências negativas

- Quem ler só o plano mestre e procurar literalmente uma tabela
  `tenant_members` no schema não a vai encontrar — mitigado por este ADR e
  por `docs/04_DATA_MODEL.md` documentar `profiles` como a tabela de
  membros.
- O enum `user_role` mantém o valor `admin` como legado nunca usado
  (remover valores de um enum Postgres em produção exige recriar o tipo —
  risco desproporcional para uma limpeza cosmética; documentado como
  `admin` depreciado, não atribuído a ninguém).

## Segurança e privacidade

`current_tenant_id()` e todas as políticas RLS existentes continuam
inalteradas — o isolamento multi-tenant já testado (`NEX-012`/`NEX-015`) não
é tocado por esta decisão. Os novos roles introduzem superfície de
autorização nova (quem pode ver o quê) — coberta pela matriz de permissões
(`NEX-211`) e por testes de autorização negativos por role (`NEX-210`/`219`),
não por esta ADR em si.
