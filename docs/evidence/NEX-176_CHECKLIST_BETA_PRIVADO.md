# NEX-176 — Checklist beta privado

## Objetivo

Avaliar, com evidência real (não suposição), se a NEXORA está pronta para uma
beta privada com uma dona e clientes reais.

## Implementação

Criado `docs/BETA_CHECKLIST.md` com os 13 itens pedidos pelo plano mestre,
cada um com estado (✅ Pronto / 🟡 Parcial / ❌ Em falta) e evidência real
(ficheiro de evidência da tarefa correspondente, teste E2E, ou grep direto
ao código para confirmar ausência).

## Resultado — NO-GO

9 de 13 itens estão prontos. 4 não estão, com risco decrescente:

1. **Testes de backup (`NEX-173`)** — mecanismo pronto nesta mesma ronda,
   sem execução real ainda (falta o secret da dona).
2. **Política de privacidade** — não existe nenhuma página pública; pedir
   dados pessoais reais sem ela é risco de conformidade, não só estético.
3. **Suporte** — nenhum canal real (`EPIC-30` ainda não implementado);
   `CLAUDE.md` já proíbe fingir um que não existe.
4. **PWA em dispositivo físico** — só verificado por leitura de
   código/manifest (`NEX-152`), nunca instalado num Android/iOS real.

Os restantes 2 itens "parciais" (tenant de teste, serviços sem dados
pessoais reais) são puramente operacionais — decisões da dona no momento de
criar o tenant de beta, não gaps de código.

## Testes obrigatórios

- Go/no-go review: cada item da checklist confrontado com evidência real
  (ficheiro de evidência, teste, ou grep de ausência), não com suposição —
  ver tabela em `docs/BETA_CHECKLIST.md`.
- `npm run verify` (ver fecho do lote).

## Definition of Done

- [x] Implementação concluída — `docs/BETA_CHECKLIST.md`
- [x] Testes concluídos — os 13 itens confrontados com evidência real
- [x] Documentação atualizada
- [x] Critérios de aceite validados — todos os gates avaliados (a checklist em si está completa; conclui NO-GO para clientes reais até 3 itens serem resolvidos, o que é o resultado correto e honesto, não uma falha da tarefa)
- [x] Tarefa marcada no `TASKS.md`
