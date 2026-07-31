# NEX-201 — Inventário único de funcionalidades e rotas

## Objetivo

Criar uma referência única de todas as rotas, capacidades, tabelas,
actions/RPC, flags, estado e cobertura de teste/documentação da aplicação
(EPIC-00 a EPIC-17), para servir de base ao plano mestre de expansão e evitar
retrabalho por desconhecimento do que já existe.

## Implementação

Criado `docs/FEATURE_ROUTE_INVENTORY.md`, 14 secções (uma por EPIC concluído),
cada uma com uma tabela markdown com as 11 colunas pedidas (Capacidade, Rota,
Componente principal, Tabelas, Actions/RPC, Flag, Estado, Teste unitário,
Teste integração, Teste E2E, Documentação) — cerca de 125 linhas cobrindo:

- todas as ~30 rotas reais (`src/app/**/{page,route,layout}.tsx`) do
  dashboard, área pública (`/b/[slug]/...`), `/marcacao`, auth, onboarding e
  API;
- as Server Actions/RPC e tabelas associadas a cada uma, confirmadas por
  pesquisa direta no código (`.rpc(`, `.from(`, ficheiros `*-actions.ts`),
  não por suposição;
- cobertura real de teste (65 unitários, 34 integração, 55 E2E) confirmada
  por grep dentro dos próprios ficheiros de teste;
- cruzamento com os 75 ficheiros `docs/evidence/NEX-*.md` existentes.

Levantamento feito por um agente dedicado, com instrução explícita de nunca
adivinhar — onde não foi possível confirmar rota/tabela/teste/documentação
com uma fonte real, a célula ficou "não confirmado"/"—" em vez de um valor
inventado (regra do plano mestre, `§27`: "não inventar números").

## Achados relevantes (fecham/confirmam gaps já conhecidos)

- Confirmado por pesquisa no código: **não existe nenhum mecanismo de
  feature flag implementado hoje** — a coluna "Flag" é "—" em todas as
  linhas; só passa a ter valores reais a partir do `EPIC-19` (`teams_enabled`
  e afins).
- Sem E2E dedicado: recorrência completa (`NEX-120`–`123`), reabrir marcação
  (`NEX-115`), pagamentos pendentes funcional (`NEX-114`), marcação manual
  completa (`NEX-085` — é exatamente o objeto do `NEX-205`, já identificado
  no plano mestre).
- Confirma, com evidência de código (não só descrição), que
  `appointment-completion-discount.spec.ts`,
  `appointment-completion-extras.spec.ts` e `appointment-card.spec.ts`
  assumem a UI inline antiga — mesmo padrão que `NEX-204` existe para
  corrigir.
- ~15 tarefas (`NEX-061`, `062`, `066`, `070`, `073`, `074`, `080`–`084`,
  `090`–`093`, `095`, `100`–`103`, `110`–`114`, `130`, `131`) não têm um
  ficheiro de evidência próprio localizável — funcionalidade existe e está
  testada, mas a documentação de evidência dessas tarefas específicas não
  foi encontrada isoladamente (provavelmente coberta só indiretamente por
  uma tarefa vizinha). Marcado como "não confirmado", não como lacuna nova
  a corrigir nesta tarefa.

## Testes obrigatórios

- Revisão cruzada do inventário contra as rotas e flags reais do código —
  feita via `Glob`/`grep` sistemático, não por memória/suposição (ver
  metodologia acima).
- `npm run verify` passa.

## Definition of Done

- [x] Implementação concluída — `docs/FEATURE_ROUTE_INVENTORY.md`
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`
