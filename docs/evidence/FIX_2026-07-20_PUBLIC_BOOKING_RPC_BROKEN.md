# Fix — `create_public_booking` nunca conseguia completar uma marcação

## Contexto

Ao testar o fluxo público para o pedido de reestruturação em páginas separadas
(`docs.reference/CLAUDE_VISUAL_EXECUTION.md`), a marcação falhava sempre no passo final
com "Não foi possível concluir a marcação." Investigação por RPC direto (`admin.rpc('create_public_booking', ...)`,
bypass da UI) revelou **três bugs independentes e reais** na função, encadeados — cada
correção revelava o seguinte. `create_public_booking` nunca completou com sucesso um
booking que incluísse pelo menos um serviço, em nenhum ambiente onde este código correu.

## Bugs encontrados e corrigidos

### 1. `pgcrypto` fora do `search_path` — `0020_fix_pgcrypto_schema.sql`

`0001_initial.sql` criou a extensão sem schema explícito (`create extension if not exists pgcrypto;`).
No Supabase, isso instala em `extensions`, não em `public`. Toda função `security definer`
deste schema restringe deliberadamente `set search_path = public` (proteção contra
search-path hijacking) — o que esconde `digest()`/`gen_random_bytes()` (só existem via
pgcrypto; `gen_random_uuid()` é nativo do Postgres 13+ e por isso nunca acusou o problema).
Erro: `function digest(text, unknown) does not exist` (42883).

Fix: `alter extension pgcrypto set schema public;`.

### 2. `ORDER BY` inválido fora do agregado — `0021_fix_create_public_booking_payload_hash.sql`

O fingerprint do payload tentava ordenar os `service_ids` selecionados com
`select string_agg(x::text, ',') from unnest(...) x order by x::text` — o `order by`
como cláusula da SELECT externa (não do agregado) exige `x` no `GROUP BY`. Erro:
`column "x.x" must appear in the GROUP BY clause` (42803). Afetava qualquer marcação
com pelo menos um serviço selecionado (o único caminho que não passa por `unnest()`).

Fix: mover o `order by` para dentro do agregado — `string_agg(x::text, ',' order by x::text)`.

### 3. Ordem de inserção errada — `0022_fix_create_public_booking_insert_order.sql`

`appointment_items` era inserido **antes** da linha `appointments` que referencia (o
total/duração eram computados inserindo cada item inline, dentro do mesmo loop, e só
depois a linha `appointments` — que precisa desses totais para `expected_total_cents`/
`end_at`/`blocked_until`, todas `NOT NULL` — era inserida). `appointment_items_tenant_appointment_fkey`
(`0002_harden_tenant_fk_integrity.sql`) não é `DEFERRABLE`, por isso falhava sempre. Erro:
`insert or update on table "appointment_items" violates foreign key constraint
"appointment_items_tenant_appointment_fkey"` (23503). Este é o bug "raiz" mais antigo —
existe desde `0007_create_public_booking.sql` (NEX-064), nunca tocado por `0018`.

Fix: função dividida em duas fases — fase 1 valida a seleção e soma totais só por
leitura (mesmas queries, sem escrever); a linha `appointments` é inserida com esses
totais já prontos; fase 2 (com `appointments` já existente) faz os inserts reais de
`appointment_items`. Sem outras mudanças de comportamento — mesma validação, mesmos
`errcode`, mesmo snapshot de preço/duração por item.

## Por que isto passou despercebido

`tests/integration/create-public-booking.test.ts` — o teste desenhado especificamente
para isto ("so transactional rollback... can be observed precisely") — exige
`TEST_DATABASE_URL` (ligação direta Postgres) e faz skip silencioso sem essa variável.
Este ambiente (projeto cloud Supabase usado como "Local", `ADR-007`, por indisponibilidade
de Docker/WSL2) só tem acesso REST/Auth, nunca teve essa variável definida — o teste
nunca correu, aqui nem presumivelmente em CI com a mesma lacuna. Todo o resto do fluxo
(disponibilidade, seleção de serviços, RLS, geração de draft) não depende de
`digest()`/`gen_random_bytes()`, por isso nunca revelou o problema.

## Testes

- RPC chamado diretamente (bypass da UI) confirmando cada erro e, no final, sucesso:
  `appointment_id`/`booking_token`/`lookup_code` devolvidos, `error: null`.
- Fluxo completo testado via Playwright contra a UI real (`/b/[slug]` → seleção de
  serviço → horário → dados → confirmar) até ao ecrã "Marcação confirmada" com código de
  consulta.
- Replay de idempotência confirmado: duas chamadas com a mesma `idempotency_key` e
  payload devolvem o mesmo `appointment_id` (`is_replay: true` na segunda, token/código
  `null` como esperado), e só existe **uma** linha em `appointments` e **uma** em
  `appointment_items` — sem duplicação.
- `npm run verify` — ✅ (sem alterações de código TypeScript, só migrações SQL).

## Aplicado

- [x] Supabase de **dev** (`znakuwpmapkhzuntzorj`) — as três migrações coladas e
      confirmadas pelo dono durante esta sessão.
- [ ] Supabase de **produção** — **ainda por aplicar**. Dado que `0001`/`0007`/`0018`
      foram publicadas identicamente em produção, o mesmo bug quase certamente afeta o
      booking público real agora. Prioridade máxima.

## Risco residual

- `tests/integration/create-public-booking.test.ts` continua sem correr neste ambiente
  (falta `TEST_DATABASE_URL`) — a lacuna de cobertura que permitiu isto persiste até essa
  variável ser configurada (local ou em CI, se a mesma lacuna existir lá).
