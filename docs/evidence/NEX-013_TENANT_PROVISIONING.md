# Evidência — NEX-013 Implementar provisioning de tenant/owner

**Data:** 17 de julho de 2026
**Estado:** concluído

## Contexto

Não há cadastro público da dona nesta versão (`CLAUDE.md`). O provisioning é uma operação administrativa: o owner corre `scripts/provision-owner.mjs`, que cria o utilizador Auth (Supabase Admin API — a única forma correta de criar credenciais, GoTrue gere o hashing de password) e depois chama a função `provision_tenant_owner` para criar tenant, profile e business_settings **atomicamente**.

## Implementação

- `supabase/migrations/0003_provision_tenant_owner.sql`: função `security definer` que faz `insert` em `tenants`, `profiles`, `business_settings` e um registo em `audit_logs`, tudo dentro da mesma chamada — qualquer exceção reverte tudo (garantia nativa do PL/pgSQL, não precisa de `BEGIN`/`COMMIT` explícito).
- Verifica antes de mutar: se `p_user_id` já tem `profile`, levanta exceção sem tocar em nada (evita tenants órfãos no caso mais comum de erro).
- `scripts/provision-owner.mjs`: script CLI (`--apply` para executar, dry-run por omissão) que orquestra a criação do utilizador Auth + a chamada à função, com mensagens claras em caso de falha parcial.

## Risco residual encontrado e corrigido: exposição acidental da função

Testei explicitamente se `anon` conseguia chamar a função (não bastava assumir que `revoke ... from public` chegava). Descobri que **conseguia** — a chamada só falhava mais tarde, num `check` constraint, prova de que a função tinha executado até esse ponto. Causa: este projeto Supabase concede `EXECUTE` a `anon`/`authenticated` diretamente (não via `PUBLIC`) em funções novas do schema `public`; `revoke ... from public` não anula concessões diretas a um role específico.

**Corrigido:** adicionados `revoke ... from anon` e `revoke ... from authenticated` explícitos na migração, mais um teste de integração dedicado que falha se isto voltar a acontecer. Registado como `ADR-008` (decisão sistémica — afeta todas as funções `security definer` futuras) e como regra nova em `CLAUDE.md`.

## Testes — rollback e auditoria

`tests/integration/provision-tenant-owner.test.ts` (4 testes, todos correram contra o projeto Supabase dev e passaram):

1. **Caminho feliz:** cria tenant (`status='setup'`), profile (`role='owner'`), business_settings e uma linha em `audit_logs` (`action='tenant.provisioned'`) — todos corretamente ligados.
2. **Rollback em falha:** chamada com `p_owner_display_name = null` falha no `insert` de `profiles` (`not null`, `23502`) **depois** do tenant já ter sido inserido — confirmado que o tenant **não** fica órfão na base (rollback real da transação da função, não só validação prévia).
3. **Duplo provisioning rejeitado:** segunda chamada para o mesmo `user_id` falha (`23505`) e não deixa tenant parcial.
4. **`anon` não consegue invocar** a função (`42501`, após a correção acima).

Script `scripts/provision-owner.mjs --apply` também testado manualmente de ponta a ponta contra o projeto dev (utilizador Auth real criado, tenant/profile/settings/audit confirmados via REST, depois limpo).

## Resultado

- `npm run verify`: aprovado.
- `ADR-008` publicado; `CLAUDE.md` atualizado com a regra de revogação explícita.
- Nenhum dado de teste ou utilizador de teste ficou por limpar no projeto dev.
- Próxima tarefa desbloqueada: `NEX-014`.
