# ADR-008 — Revogação explícita de EXECUTE em funções `security definer`

## Estado

Aceite

## Contexto

Ao implementar `provision_tenant_owner` (`NEX-013`), `revoke all on function ... from public` não impediu `anon` de a invocar via `/rest/v1/rpc/provision_tenant_owner` — a chamada só falhou mais tarde, por violar um `check` constraint, prova de que a função **executou**. Causa: este projeto Supabase concede `EXECUTE` a `anon` e `authenticated` diretamente (não via PUBLIC) em novas funções do schema `public`, por omissão. `revoke ... from public` não remove uma concessão feita diretamente a um role específico — é preciso revogar de `anon`/`authenticated` explicitamente.

Isto é sistémico: qualquer função `security definer` futura (criação de marcação transacional em `NEX-064`, conclusão financeira em `NEX-113`, etc.) fica publicamente invocável por omissão a menos que o autor se lembre de revogar explicitamente destes dois roles.

## Opções

1. Confiar em `revoke ... from public` e lembrar caso a caso — já provou falhar silenciosamente.
2. Desativar globalmente a exposição automática de novas funções via `alter default privileges` a nível de schema.
3. Tratar "revogar de `anon` e `authenticated` explicitamente" como parte obrigatória do padrão de toda função administrativa/`security definer`, verificado por teste de integração dedicado (como em `NEX-013`).

## Decisão

Opção 3. Toda função `security definer` que não deva ser chamável pela API pública deve terminar com:

```sql
revoke all on function public.nome_funcao(tipos...) from public;
revoke all on function public.nome_funcao(tipos...) from anon;
revoke all on function public.nome_funcao(tipos...) from authenticated;
grant execute on function public.nome_funcao(tipos...) to service_role; -- ou o role específico necessário
```

Cada tarefa que crie uma função deste tipo deve incluir um teste de integração que confirme `anon`/`authenticated` recebem `42501` (ou equivalente) ao tentar invocá-la — não basta ler o código, como este caso demonstrou.

## Consequências positivas

- Fecha uma classe inteira de vulnerabilidades de exposição acidental de funções administrativas.
- Torna o padrão verificável por teste, não só por revisão manual.

## Consequências negativas

- Boilerplate extra (3 linhas) em cada função `security definer` nova.
- Não resolve a causa raiz na plataforma (o comportamento de omissão do Supabase permanece); é uma mitigação por convenção de código, não uma mudança de configuração global do projeto (opção 2 foi descartada para não arriscar bloquear inadvertidamente funções que precisam de ficar públicas, ex. `current_tenant_id`).

## Segurança e privacidade

Risco de exposição de escrita administrativa a `anon`/`authenticated` — mitigado pela convenção acima. `CLAUDE.md` atualizado para referenciar esta regra.
