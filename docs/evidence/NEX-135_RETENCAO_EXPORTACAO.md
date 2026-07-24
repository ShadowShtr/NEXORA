# NEX-135 — Regras de retenção/exportação

## Implementação

- **Limites**: já garantidos desde `NEX-131` — `resolveCustomRange` (`src/features/finance/domain/period.ts`) limita qualquer intervalo personalizado a, no máximo, 366 dias, antes de qualquer rota de exportação (`NEX-132`/`133`/`134`) chegar a consultar a base de dados. Nada novo a construir aqui, só confirmar/testar.
- **Acesso seguro**: inalterado — as 3 rotas de exportação já dependiam só de `requireProfile()` (sessão), nunca de dados do pedido.
- **Logging**: `supabase/migrations/0034_log_finance_export.sql` (novo): `log_finance_export(p_format, p_view, p_range_days)` — escreve uma linha em `audit_logs` (`finance.exported`) por exportação, com o formato, a vista e a duração do período. `src/features/finance/log-export.ts`: `logFinanceExport`, chamado pelas 3 rotas depois de gerar o ficheiro — falha silenciosamente (não bloqueia o download) se o registo de auditoria falhar, porque a exportação em si é a funcionalidade principal que a dona está à espera.

## Testes

- **"Large range"**: já coberto desde `NEX-131` (`tests/unit/finance-period.test.ts`: `"clamps a pathologically wide range instead of resolving unbounded years of data"`, um intervalo de 26 anos clampado a ≤366 dias). Não duplicado.
- **"Authorization"**: `tests/unit/require-profile.test.ts` (novo, 3/3 ✅) — `requireProfile()` é o único portão de autorização que as 3 rotas de exportação (e todas as páginas do dashboard) usam, por isso testar uma vez aqui cobre as três em vez de repetir a mesma lógica de redirecionamento três vezes. Totalmente mockado (sem precisar de um projeto Supabase real): sem sessão → redireciona para `/login`; sessão sem perfil correspondente → termina sessão e redireciona para `/login?error=no_profile`; sessão válida → devolve a identidade sem redirecionar.
- `tests/integration/log-finance-export.test.ts` (novo, 3/3 ✅): anon bloqueado (`42501`); formato inválido rejeitado (`22023`); uma linha de auditoria por formato (csv/xlsx/pdf), com os metadados corretos, incluindo a confirmação de que `range_days: 366` (o valor já clampado) é o que fica registado.
- `npm run verify` (format, lint, typecheck, 399 testes, build) — ✅.

## Resultado

Fecha o `EPIC-13` (financeiro e relatórios): as 3 exportações (`NEX-132`/`133`/`134`) já respeitavam limites e autorização por construção; esta tarefa só confirmou isso com testes dedicados e acrescentou o registo de auditoria que faltava.

## Riscos residuais

`log_finance_export` não valida `p_range_days` por si própria — o limite real (366 dias) já é aplicado em TypeScript antes de a rota alguma vez chamar esta RPC. Um valor fora desse limite a chegar à RPC (só possível chamando-a diretamente, não através da UI) não representaria um bypass de nada — a RPC só regista metadados de auditoria, não executa a exportação em si.

## Próxima tarefa desbloqueada

Nenhuma dentro do `EPIC-13` (todas as tarefas concluídas). Backlog livre para seguir por ordem em `TASKS.md`.
