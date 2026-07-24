# NEX-125 — Horários especiais

## Implementação

- `src/features/settings/business-hours-exceptions-actions.ts` (novo): `createBusinessHoursException` (validação espelha `dayHoursSchema` do onboarding, `features/onboarding/domain/hours-step.ts` — mesmas regras, aplicadas a uma data em vez de uma semana) e `deleteBusinessHoursException` (`hasAffectedRows` após o `.delete()`, `ADR-010`). Sem migração nova: `business_hours_exceptions` já existe desde `0006_business_hours_exceptions.sql` (NEX-060), com RLS CRUD tenant-scoped completo — só nunca tinha sido usada por nenhuma ação/UI.
- `src/features/settings/BusinessHoursExceptionsManager.tsx` (novo): uma data + escolha "Aberto (com horário próprio)" ou "Fechado" — o mesmo par de estados que a tabela já modela — mais a lista de horários especiais futuros com remoção.
- `src/app/(dashboard)/dashboard/definicoes/page.tsx`: novo cartão "Horários especiais".
- **"Mostrar publicamente" não precisou de nenhum código**: `resolveDayHours` (`domain/daily-schedule.ts`) já prefere a exceção ao horário semanal em todo o lado onde a disponibilidade é calculada, e `getPublicAvailability` (NEX-062) já lê `business_hours_exceptions` via o cliente service-role (a tabela não tem política `anon` por desenho — o horário em bruto nunca é exposto diretamente).

## Testes

- **"Precedência de regras"** (teste obrigatório desta tarefa) já estava coberto desde a NEX-060: `tests/unit/daily-schedule.test.ts` → `"prefers an exception over the weekly schedule for the same date"`. Não duplicado.
- `tests/integration/business-hours-exceptions-impact.test.ts` (novo, 2/2 ✅): prova a outra metade do critério de aceite — "abrir dia fechado ... e mostrar publicamente" — de ponta a ponta através de `getPublicAvailability` (o mesmo caminho que um visitante real percorre): abrir um dia normalmente fechado com uma exceção torna-o reservável na página pública; fechar um dia normalmente aberto remove-o da disponibilidade pública.
- `npm run verify` (format, lint, typecheck, 368 testes, build) — ✅.
- UI não testada num browser real (mesma limitação das restantes tarefas desta sessão — sem staging Supabase separado, `ADR-007`).

## Resultado

Fecha o `EPIC-12` (recorrência e disponibilidade avançada, `NEX-120` a `NEX-125`). A dona pode agora abrir um dia normalmente fechado, encurtar/prolongar um dia normalmente aberto, ou fechar um dia normalmente aberto (feriado), tudo a partir de Definições — sem nenhuma tabela ou RPC nova, porque o modelo de dados e o motor de disponibilidade já estavam prontos desde `NEX-060`/`NEX-061`.

## Riscos residuais

Nenhum novo — mesma limitação de UI não testada num browser real já registada nas tarefas anteriores desta sessão.

## Próxima tarefa desbloqueada

Nenhuma dentro do `EPIC-12` (todas as tarefas concluídas). Backlog livre para seguir por ordem em `TASKS.md` (próximo bloco desbloqueado: `EPIC-13`/`NEX-140`+ ou outros, a confirmar dependências).
