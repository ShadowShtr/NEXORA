# NEX-203 — Criar harness de regressão visual

## Objetivo

Capturas determinísticas das páginas mínimas listadas no plano mestre, sem
depender de Percy, Chromatic ou qualquer serviço externo pago.

## Implementação

`tests/e2e/visual-regression.spec.ts` — usa só `expect(page).toHaveScreenshot()`
do Playwright (já uma dependência do projeto), comparando contra baselines PNG
commitadas em `tests/e2e/visual-regression.spec.ts-snapshots/`. Cobre as 16
páginas/estados pedidos, em 2 testes:

**Dashboard (tenant vazio, um único login/provisionamento reaproveitado):**
login, Início, Agenda dia, Agenda semana, Clientes, ficha de cliente,
Serviços, Financeiro, Lembretes, Mais, Definições.

**Página pública (`PublicBookingFlow`, o page-object já usado por outras specs
públicas):** perfil, serviços, horários, resumo, confirmação.

### Duas decisões deliberadas para manter isto sem custo e sem instabilidade

1. **Sempre que uma página pode mostrar um estado genuinamente estático** (um
   tenant recém-criado, sem marcações), o teste semeia exatamente isso em vez
   de a popular — um estado vazio não tem nenhum dado dinâmico (sem datas,
   sem "há 2 dias" relativo, sem iniciais de avatar aleatórias) e não precisa
   de nenhuma máscara. Só onde isso é impossível (o resumo/confirmação da
   marcação pública, que mostra sempre a data/hora reais de hoje) se usa
   `mask` para ocultar especificamente essa linha.
2. **As baselines só podem ser geradas pelo próprio CI** (`ubuntu-latest`, o
   mesmo runner onde `e2e-critical` já prova que Docker/browsers funcionam),
   nunca localmente. Confirmado nesta tarefa: correr o harness localmente
   nesta máquina Windows com `--update-snapshots` gera ficheiros
   `*-win32.png` — o Playwright inclui a plataforma no nome do ficheiro de
   snapshot, por isso uma baseline gerada aqui **nem seria usada** na
   comparação num runner Linux (que procura `*-linux.png`). Geradas e
   descartadas nesta sessão só para provar que o mecanismo funciona
   (16/16 capturas concluídas sem erro, ver secção seguinte) — não
   commitadas.

## Mecanismo de CI

`.github/workflows/visual-regression.yml`:

- `pull_request`: compara contra as baselines commitadas — só corre de facto
  se a variável de repositório `VISUAL_REGRESSION_ENABLED` estiver `'true'`
  (mesma técnica de "não quebrar PRs antes de a dona ativar" usada em
  `NEX-173`).
- `workflow_dispatch` com `update: true`: corre com `--update-snapshots` e
  faz commit + push das baselines novas/alteradas diretamente para a branch
  que disparou o workflow.
- Reutiliza o padrão já provado do job `e2e-critical` (`supabase/setup-cli`,
  `supabase start`, `supabase status -o env`, build de produção antes dos
  testes) — nenhuma infraestrutura nova.

## Estado real desta tarefa — o que falta

O harness foi **executado com sucesso nesta sessão** (localmente, contra o
Supabase de dev/preview real) — as 16 capturas foram geradas sem nenhum erro
de seletor, navegação ou seed, confirmando que a mecânica (login,
provisionamento, navegação, máscaras) funciona de facto. **Não existem ainda
baselines reais (Linux) commitadas** — isso só pode acontecer disparando
`workflow_dispatch` com `update: true` no GitHub Actions, o que não fiz (não
tenho como acionar workflows do GitHub a partir deste ambiente sem o pedido
explícito de push/execução já autorizado para esta sessão, e a criação das
baselines é melhor feita como um passo consciente, revisto visualmente pela
dona antes de se tornar a referência "correta"). Falta:

1. Confirmar a variável de repositório `VISUAL_REGRESSION_ENABLED=true`
   (Settings → Secrets and variables → Actions → Variables) quando for para
   ativar a comparação em PRs.
2. Disparar `gh workflow run "Regressão visual (NEX-203)" -f update=true`
   uma vez, rever as capturas geradas no artifact/commit resultante, e só
   depois confiar nelas como baseline.

**Até esse passo ser feito, a Definition of Done desta tarefa fica parcial**
— mesmo padrão de honestidade de `NEX-173`.

## Testes obrigatórios

- Execução local completa do harness (`--project=chromium
--update-snapshots`), 2/2 testes, 16/16 capturas sem erro — confirma a
  mecânica; baselines descartadas por serem `-win32` (irrelevantes para a
  comparação real em CI, ver acima).
- Sintaxe do workflow validada (`js-yaml`).
- `npm run verify` (ver fecho do lote).

## Definition of Done

- [x] Implementação concluída — harness + workflow de CI
- [ ] Testes concluídos — mecânica provada localmente; baselines Linux reais pendentes de um `workflow_dispatch` real
- [x] Documentação atualizada
- [ ] Critérios de aceite validados — cobre as 16 páginas pedidas, mas sem baseline real ainda não há "regressão" a detetar
- [ ] Tarefa marcada no `TASKS.md` — marcada `[~]`, não `[x]`, até às baselines reais
