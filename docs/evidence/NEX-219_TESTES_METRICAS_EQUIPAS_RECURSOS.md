# NEX-219 — Testes e métricas de equipas/recursos

## Cobertura de testes pedida no épico — onde já existe / o que foi acrescentado

| Item pedido                             | Onde está coberto                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Isolamento tenant                       | Já coberto: `resource_services`/`provider_services`/`appointments` cross-tenant (NEX-215's `resources-and-overlap.test.ts`); **novo**: `team-member-lifecycle.test.ts` acrescenta o caso de um `update` de perfil filtrado pelo tenant errado devolver zero linhas (o mesmo invariante que `hasAffectedRows`/ADR-010 depende).                               |
| Permission matrix                       | Já coberto integralmente: `tests/unit/permissions.test.ts` (NEX-211, 73 testes, todas as combinações role×permissão).                                                                                                                                                                                                                                        |
| Conflito entre prestadores              | Já coberto: `resources-and-overlap.test.ts` ("two different providers CAN overlap" / "the SAME provider cannot").                                                                                                                                                                                                                                            |
| Conflito de recurso                     | Já coberto: `resources-and-overlap.test.ts` ("the SAME resource cannot be double-booked").                                                                                                                                                                                                                                                                   |
| Rececionista cria mas não vê financeiro | Coberto ao nível da matriz (`receptionist` não tem `view_amounts` em `permissions.test.ts`); a aplicação real desta regra numa página de financeiro concreta ainda não existe — nenhuma página de financeiro verifica `hasPermission` hoje (assunção de dona única em todo o código anterior a este lote). Risco residual, não escondido: ver secção abaixo. |
| Provider vê apenas o permitido          | Coberto ao nível da matriz (`provider` só tem `view_agenda`/`complete_appointment`); a restrição "só a própria agenda" é uma restrição por linha, documentada como fora do âmbito da matriz booleana no próprio `permissions.ts` — nenhuma query hoje filtra a agenda por `provider_id = próprio`. Mesmo risco residual.                                     |
| Desativação de membro                   | **Novo**: `team-member-lifecycle.test.ts` — `assert_not_last_owner` bloqueia demover/desativar a única dona ativa, permite quando há uma segunda dona ativa, e é no-op para não-donas; desativar um membro (`is_active=false`) preserva o perfil (não apaga).                                                                                                |
| Timezone por prestador                  | Já coberto: `tests/unit/provider-schedule.test.ts` (NEX-213, `resolveProviderDayHours`) e o motor multi-recurso (`tests/unit/multi-resource-availability.test.ts`, NEX-216).                                                                                                                                                                                 |
| Acessibilidade da nova página           | Não foi possível correr axe real — mesma limitação de NEX-217/218 (sem Docker/BD local, sem sessão autenticável neste ambiente).                                                                                                                                                                                                                             |

## Métricas

`src/features/team/domain/metrics.ts` (novo) — funções puras, testadas em
`tests/unit/team-metrics.test.ts` (5 testes):

- `computeProviderUtilization(providerId, availableMinutes, occupiedMinutes)` —
  percentagem de utilização por prestador, sem `NaN`/`Infinity` quando não há
  horas disponíveis.
- `summarizeTeamMetrics(utilizations)` — agrega prestadores ativos, total de horas
  disponíveis/ocupadas e utilização média.

**"Conflitos evitados" não foi implementado**: nada no esquema regista uma tentativa
de marcação bloqueada como um evento distinto — a exclusão de sobreposição
(ADR-012) simplesmente falha o `insert`, sem deixar rasto para além do erro devolvido
nesse momento. Contar "conflitos evitados" exigiria instrumentação nova (um log de
tentativas rejeitadas), fora do âmbito desta tarefa — inventar um número aqui violaria
a regra do CLAUDE.md contra dados fabricados.

**Sem página de relatórios a consumir isto ainda**: esta tarefa entrega a camada de
domínio testada; uma página `/dashboard/relatorios` (ou uma secção dela) que busque
`occupiedMinutes`/`availableMinutes` reais por prestador e os passe a estas funções
fica para uma iteração futura — não fazia parte do que este lote conseguiu construir e
verificar com confiança dentro do tempo disponível.

## Risco residual mais importante desta tarefa

A aplicação real de `hasPermission` a páginas já existentes (Financeiro, Agenda
completa vs. só própria de um prestador) não foi retrofitada neste lote — só a nova
página de Equipa e as suas Server Actions (NEX-217) e a criação de convites (NEX-212)
verificam `manage_team` hoje. Isto significa que, na prática atual, um utilizador com
role `receptionist` ou `provider` autenticado ainda consegue navegar para
`/dashboard/financeiro` e vê-lo — a matriz de permissões existe e está correta, mas
ainda não está aplicada a todas as páginas que deveria restringir. Isto é maior do que
"escrever testes" tal como pedido no épico; é uma lacuna de produto real que deve ser
resolvida antes de multi-prestador ir para produção, e fica documentada aqui em vez de
escondida.

## Verificação

`npm run verify` completo: format, lint, typecheck, 640 testes (229 skipped),
`next build`, bundle budget — tudo verde, incluindo os 2 novos ficheiros de teste
(`team-metrics.test.ts` real e a passar; `team-member-lifecycle.test.ts` escrito,
execução real pendente do CI).

## Estado

`[~]` parcial — testes reais para o que já foi construído neste EPIC; métricas
implementadas ao nível de domínio; gaps de "quem vê o quê" nas páginas antigas e
"conflitos evitados" documentados como risco residual, não como trabalho escondido.
