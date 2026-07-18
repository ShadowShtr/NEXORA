# NEX-060 — Modelar horários e exceções

## Implementação

- `supabase/migrations/0006_business_hours_exceptions.sql` (novo): tabela `business_hours_exceptions` — uma `exception_date` específica substitui o padrão semanal de `business_hours` (`0001_initial.sql`) só para essa data, modelando o "horário especial" descrito em `docs/01_PRODUCT_REQUIREMENTS.md` §3 ("Dona pode criar horário especial"). Mesma forma/constraints de `business_hours` (mesma validação `opens_at < closes_at` só quando `is_open=true`, mesma validação de almoço, sem `created_at`/`updated_at` — ambas config-like, substituídas por inteiro em vez de acompanhadas campo a campo), com `unique (tenant_id, exception_date)` em vez de `unique (tenant_id, day_of_week)`.
  - Distinção deliberada de `availability_blocks` (já existente): um bloqueio/férias marca tempo **indisponível** dentro/à volta do horário normal, sem alterar o que esse horário normal é; uma exceção **redefine** o horário para uma data — pode ser mais restritivo (fechado num feriado), menos restritivo (horário alargado) ou só diferente (sem almoço nesse dia). O motor de disponibilidade (`NEX-061`/`062`, ainda não construído) deve preferir a exceção sobre `business_hours` na data correspondente, e só depois subtrair `availability_blocks` sobrepostos.
  - RLS: mesmo padrão CRUD tenant-scoped das "ordinary tables" (`0001_initial.sql`), escrito diretamente porque essa migration já correu e é imutável (`NEX-011`). **Sem política `anon`** — tal como `business_hours`, a agenda em bruto nunca é exposta diretamente ao público; só os slots computados o serão, via função `security definer` numa tarefa futura (`ADR-008`).
- `docs/04_DATA_MODEL.md`: nova entidade no ERD (`BUSINESS_HOURS_EXCEPTIONS`) e nota explicando a distinção face a `availability_blocks`.

## Testes

- `tests/integration/business-hours-exceptions.test.ts` (novo, 11/11 ✅, gated pelas mesmas env vars de `rls-tenant-isolation.test.ts`): leitura própria; leitura cruzada bloqueada; **anon bloqueado** (sem política pública); insert cruzado bloqueado (`42501`); update/delete cruzados bloqueados (no-op silencioso); update próprio permitido; `exception_date` duplicada no mesmo tenant rejeitada (`23505`); `is_open=true` com `opens_at >= closes_at` rejeitado (`23514`); `is_open=false` com horas nulas aceite (dia fechado); `lunch_ends_at` antes de `lunch_starts_at` rejeitado (`23514`).
- **Confirmado em execução real de CI** contra Supabase local (não simulado, primeira vez à primeira tentativa graças à infraestrutura de `NEX-015`): [run 29642986865](https://github.com/ShadowShtr/NEXORA/actions/runs/29642986865) — 9/9 ficheiros, **56/56 testes de integração** (45 pré-existentes + 11 novos).
- `npm run verify` — ✅.

## Resultado

O modelo de dados agora cobre os 5 conceitos do critério de aceite: normal e almoço (`business_hours`, já existente), bloqueios e férias (`availability_blocks`, já existente, cobre ambos genericamente via `reason`/`is_all_day`), e especial (`business_hours_exceptions`, novo). Nenhuma UI construída nesta tarefa — é puramente modelo de dados, como pedido ("Testes obrigatórios: Integração DB", sem menção a E2E/UI). A gestão completa de bloqueios ("Pontual, semanal, dia, intervalo e férias") fica para `NEX-124`, que já depende explicitamente de `NEX-060`.

## Riscos residuais

Nenhum identificado — a tabela não introduz nenhuma superfície nova de escrita pública nem depende de dados de outro tenant.

## Próxima tarefa desbloqueada

NEX-061 — Implementar gerador de slots timezone-aware (depende de NEX-060, concluída).
