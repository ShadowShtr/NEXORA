# Evidência — NEX-011 Rever e endurecer schema inicial

**Data:** 17 de julho de 2026
**Estado:** concluído

## Revisão feita

Leitura linha a linha de `supabase/migrations/0001_initial.sql` contra `docs/04_DATA_MODEL.md` e `docs/05_SECURITY_PRIVACY.md`. `0001` não foi editada (imutável após aceite); todos os reforços entraram em `supabase/migrations/0002_harden_tenant_fk_integrity.sql`, aplicada e verificada no projeto Supabase dev (`ADR-007`).

## Achados e correções

1. **Integridade referencial cross-tenant incompleta.** FKs como `appointments.client_id`, `services.category_id`, `payments.appointment_id`, etc. só garantiam que a linha referenciada existia — não que pertencia ao mesmo tenant da linha que a referencia. RLS valida o `tenant_id` da própria linha em INSERT/UPDATE, mas nunca validava o tenant do recurso referenciado. Corrigido: `unique (tenant_id, id)` nas tabelas-alvo + FKs compostas `(tenant_id, xxx_id) references yyy (tenant_id, id)` em 11 relações. `appointment_items.source_id` fica sem FK por ser polimórfico (service/package) — documentado via `comment on column`.
2. **Índices em falta.** Postgres não indexa colunas de FK automaticamente. Adicionados 9 índices em colunas de FK/filtro sem cobertura (`services.category_id`, `package_services.service_id`, `recurring_series.client_id`, `appointments.recurring_series_id`, `appointment_items.appointment_id`, `payments.appointment_id`, `payments(tenant_id, status)` para `NEX-114`, `availability_blocks(tenant_id, starts_at, ends_at)`, `client_photos.client_id`).
3. **Invariantes financeiras em falta em `appointment_items`.** `source_id` podia ficar `null` para uma linha `service`/`package` (bug silencioso); `unit_price_cents` não tinha verificação de sinal (descontos deviam ser negativos, o resto não-negativo). Ambos corrigidos com `check` constraints.
4. **`updated_at` dependia de disciplina da aplicação.** Nenhuma tabela tinha trigger a manter `updated_at`; ficava ao critério de cada `UPDATE` lembrar-se de o definir. Adicionada função `set_updated_at()` + triggers em `tenants`, `business_settings`, `services`, `packages`, `appointments`, `payments`.

## Testes SQL de invariantes

Novo `tests/integration/schema-invariants.test.ts` (Vitest + `pg`, gated por `TEST_DATABASE_URL`; sem BD configurada os testes ficam `skip`, não falham `npm run verify`). 7 testes, todos correram contra o projeto Supabase dev e passaram:

- rejeita `services` referenciando categoria de outro tenant (`23503`);
- rejeita `appointments` referenciando cliente de outro tenant (`23503`);
- exige `source_id` em item `service`/`package` (`23514`);
- permite `manual_extra`/`discount` sem `source_id`;
- rejeita `unit_price_cents` positivo em `discount` (`23514`);
- aceita `unit_price_cents` negativo em `discount`;
- confirma que `updated_at` é atualizado automaticamente por trigger.

## Migração aplicada e idempotência

- `supabase db push --db-url ... --dry-run` → detetou `0002_harden_tenant_fk_integrity.sql` pendente.
- `supabase db push --db-url ... --yes` → aplicada com sucesso (aviso não bloqueante sobre cache do `pg-delta`, que depende de Docker — não impede a aplicação da migração SQL).
- `supabase db push --db-url ... --dry-run` novamente → `"Remote database is up to date"`.
- Confirmado via `information_schema`/`pg_indexes`/triggers que todas as 11 FKs compostas, 9 índices e 6 triggers foram criados como esperado.

## Resultado

- `npm run verify`: aprovado.
- `pg`/`@types/pg` adicionados como devDependencies (necessários para os testes de integração; sem impacto no bundle de produção).
- `docs/04_DATA_MODEL.md` atualizado com a regra de FK composta e a origem de `updated_at`.
- `docs/ENVIRONMENTS_AND_SECRETS.md` atualizado com `TEST_DATABASE_URL`.
- Próxima tarefa desbloqueada: `NEX-012` (parte do reforço de RLS já foi feito aqui a nível de FK; `NEX-012` cobre a revisão completa de políticas).
