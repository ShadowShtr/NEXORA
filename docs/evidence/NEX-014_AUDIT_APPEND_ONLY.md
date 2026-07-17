# Evidência — NEX-014 Implementar auditoria append-only

**Data:** 17 de julho de 2026
**Estado:** concluído

## O que já existia

`audit_logs` já tinha RLS ativa com apenas uma policy de `SELECT` para `authenticated` (`NEX-001`) — sem policy de `INSERT`/`UPDATE`/`DELETE`, RLS já negava essas operações a `anon`/`authenticated`. `provision_tenant_owner` (`NEX-013`) já demonstrava a escrita correta: só código server-side com `service_role`/`security definer` grava auditoria.

## Lacuna encontrada

RLS não se aplica a `service_role` (tem `BYPASSRLS`) nem a `postgres`. Isso significa que, apesar de a UI nunca conseguir escrever diretamente, um bug em código server-side (ou numa migração futura) podia silenciosamente alterar ou apagar histórico de auditoria sem qualquer bloqueio. Faltava uma garantia estrutural, não dependente de role.

## Implementação

`supabase/migrations/0004_audit_logs_immutable.sql`:

- Função `reject_audit_log_mutation()` + triggers `BEFORE UPDATE`/`BEFORE DELETE` em `audit_logs` — disparam para **qualquer** role, incluindo `service_role`/`postgres` (triggers, ao contrário de RLS, não têm exceção por `BYPASSRLS`).
- **Efeito colateral encontrado e corrigido:** `audit_logs.tenant_id` tinha `on delete set null` (`0001`). Apagar um tenant gera um `UPDATE` interno em cada linha de auditoria que o referencia — o próprio trigger de imutabilidade bloqueava essa operação, tornando impossível apagar qualquer tenant com histórico. Corrigido trocando para `on delete restrict`: coerente com o facto de a remoção de tenant já ser soft delete (`tenant_status='deleted'`) neste produto — um `DELETE` físico nunca foi um fluxo desenhado.

## Testes — tentativa de alteração negada

`tests/integration/audit-log-immutability.test.ts` (4 testes, ligação direta a Postgres para testar mesmo o role mais privilegiado, não só `anon`/`authenticated`):

1. Insert de uma nova linha de auditoria é permitido.
2. `UPDATE` numa linha existente é rejeitado (mensagem "append-only"), mesmo pelo role de ligação (equivalente a `service_role`/superuser).
3. `DELETE` numa linha existente é rejeitado, mesma garantia.
4. Apagar (hard delete) o tenant referenciado por uma linha de auditoria é rejeitado (`23503`, violação de FK) — confirma o novo `on delete restrict`.

**Nota sobre dados residuais:** por ser mesmo append-only, o teste não consegue limpar a linha de auditoria nem o tenant que criou (fica `status` original, nunca apagado) — fica 1 tenant + 1 linha de auditoria residual por execução no projeto Supabase dev (descartável, `ADR-007`). É uma consequência direta e esperada da garantia testada, não um leak acidental.

## Regressão encontrada e corrigida

Ao aplicar a correção de FK, os testes de `NEX-013` (`provision-tenant-owner.test.ts`) passaram a falhar silenciosamente na limpeza: o `afterAll` fazia `DELETE` nos tenants de teste, e estes já tinham linha de auditoria (`tenant.provisioned`), agora bloqueada pelo `on delete restrict`. Corrigido trocando o hard delete por soft delete (`update status = 'deleted'`) no `afterAll` — exatamente o mecanismo real do produto. Tenants órfãos já criados por execuções anteriores foram marcados como `deleted` manualmente para limpar o projeto dev.

## Resultado

- `npm run verify`: aprovado.
- Suite de integração completa (22 testes em 4 ficheiros) corrida e aprovada após a correção.
- `docs/04_DATA_MODEL.md` atualizado com a garantia e a consequência para remoção de tenants.
- Próxima tarefa desbloqueada: `NEX-015` (fecha `EPIC-01`).
