# NEX-154 — Auditoria WCAG 2.2 AA

## Implementação

O ponto de partida era um risco já sinalizado (`NEX-151`/`NEX-150`): `#ed3f79`, uma cor
rosa fora da escala de tokens, aparecia em ~15 locais do CSS, alguns possivelmente
falhando contraste AA. A auditoria revelou uma família bem maior de cores ad-hoc
correlacionadas (variações próximas de `#ed3f79`/`#f5xxxx`/`#dxxxxx`) nunca
consolidadas nos tokens de `NEX-150`.

**Metodologia**: para cada cor, calculado o contraste real (`contrastRatio()`,
`src/lib/color-contrast.ts`) contra o fundo efetivo de cada uso — nunca só contra
branco — e classificado cada uso como texto (precisa ≥4,5:1, ou ≥3:1 se
"texto grande" pela definição da WCAG: ≥18,66px a negrito ou ≥24px normal) ou
ícone/decorativo/fronteira de controlo (precisa só ≥3:1, WCAG 1.4.11).

**23 falhas reais de AA confirmadas e corrigidas**, substituídas pelo token
semanticamente correto — nunca trocadas às cegas por seguirem a mesma família de cor:

- **`var(--pink-600)`** (acento de marca — links, botões de ação, badges de
  contagem/pendente): `.next-client-label`, `.next-client-value`,
  `.today-agenda-time`, `.agenda-view-tabs .nx-tab[aria-current='page']`,
  `.period-option[data-active='true']`, `.next-client-empty-action`,
  `.home-section-link`, `.reminder-icon`, `.quick-action-card`,
  `.duration-chip[data-active]`, `.package-card-discount`,
  `.service-photo-remove-button`, `.reminder-summary-card[data-type='pending']`,
  `.reminder-status-icon`/`.reminder-status-badge` (estado base),
  `.pending-payment-mark-button`, `.reminder-group-count`, `.more-menu-badge`,
  `.mark-sent-button`, `.public-about-more`.
- **`var(--danger)`** (já existia, já cumpria AA — só não estava a ser usado onde
  devia): `.revenue-comparison-value[data-trend='negative']`,
  `.reminder-summary-card[data-type='late']`,
  `.reminder-status-icon`/`.reminder-status-badge[data-status='overdue']`,
  `.logout-button`.
- **`var(--warning)` (token novo, `#975c10`)**: não existia nenhuma cor "aviso/
  pendente" formalizada — `#e58c19`/`#e59220` (o mesmo tom com um dígito de
  inconsistência entre si) só tinha **~2,5:1**, a falha mais grave encontrada, em
  `.summary-card[data-type='pending'] .summary-icon`,
  `.payment-method-card[data-method='pending'] .payment-method-icon`/
  `.payment-method-percentage`, e — o caso mais crítico — `.pending-payment-value`,
  o valor monetário de pagamentos pendentes na página Financeiro.
- **Gradientes com texto/ícone branco** (mesmo problema da `NEX-150`, mesma correção —
  substituídos por `linear-gradient(145deg, var(--pink-500), var(--pink-600))`):
  `.service-category-chip[data-active]`, `.services-filter-button[data-active]`
  (consistência), `.full-report-button`, `.public-booking-button` (o botão principal
  da página pública de marcação), `.next-client-button`, `.desktop-nav-logo` (o "N"
  da marca, visível em todas as páginas desktop), `.primary-save-button`,
  `.reminder-filter-chip[data-active='true']`.

**Deixado como estava, por já cumprir o limiar de 3:1 aplicável a ícones/controlos**
(WCAG 1.4.11, não 1.4.3): `.next-client-time` (texto grande, 23px a negrito, passa a
3:1), `.summary-icon`, `.finance-calendar-button`, `.payment-method-icon[data-method='cash']`,
`.payment-progress-fill`, `.finance-summary-dot`, `.public-information-icon`,
`.public-quick-action-icon`, `.appointment-timeline-complete-trigger`,
`.service-toggle`/`.category-visibility-toggle` (fronteira do interruptor com o
indicador branco), `.clients-fab`, `.services-fab`. Confirmado que os estados
transmitidos por cor (`.reminder-status-badge`/`.reminder-status-icon`) também têm
sempre texto real (`REMINDER_BADGE_LABELS`) e o ícone tem `aria-hidden="true"` — não
dependem só da cor (WCAG 1.4.1).

**Não auditado exaustivamente**: dezenas de cores cinzentas/neutras (`#8b858e`,
`#a19aa3`, etc., usadas para texto secundário/placeholder em toda a app) também
mostraram contraste abaixo de 4,5:1 contra branco numa varredura preliminar. Decisão
consciente de não as tratar nesta tarefa — são uma família completamente diferente
(neutros, não a marca rosa/vermelho/laranja), usada em dezenas de componentes por
toda a app, e corrigir todas exigiria rever cada uma individualmente (tamanho de
letra, se é texto "incidental"/desativado com isenção da WCAG, fundo real). Fica
registado como o maior risco residual desta tarefa.

## Testes

- `tests/unit/design-tokens-contrast.test.ts` — estendido com `--warning` (2 novos
  casos, 16 no total).
- `tests/e2e/finance-reminders-axe.spec.ts` (novo) — cobre o teste obrigatório desta
  tarefa ("axe"): varre Financeiro, Pagamentos pendentes, Lembretes e Relatórios —
  as páginas onde esta tarefa encontrou e corrigiu falhas reais de `color-contrast`,
  e que não tinham nenhuma cobertura axe antes.
- **"Manual screen reader"**: não executado com leitor de ecrã real nesta sessão (sem
  hardware/software disponível). Validado por revisão de código nas áreas tocadas:
  ícones decorativos junto de badges de estado têm `aria-hidden="true"` e o estado em
  si é sempre comunicado por texto real, não só cor.
- **"Manual keyboard"**: coberto por `tests/e2e/navigation-breakpoints-keyboard.spec.ts`
  (`NEX-151`, já existente) para a navegação; os elementos alterados nesta tarefa são
  todos `<button>`/`<a>` nativos (nenhum `<div onClick>`), continuam operáveis por
  teclado sem alteração de markup.
- **Nota**: tal como os restantes specs E2E deste repositório, não corre no CI atual
  (sem job de Playwright configurado).
- `npm run verify` (format, lint, typecheck, 432 testes, build) — ✅.

## Resultado

23 falhas reais de contraste AA corrigidas em ~30 declarações CSS, incluindo o botão
principal da página pública de marcação, o logótipo da marca, e valores monetários de
pagamentos pendentes. Novo token `--warning` formaliza a cor de "aviso/pendente",
antes inconsistente entre si (`#e58c19` vs `#e59220`) e sem verificação de contraste
nenhuma.

## Riscos residuais

- Dezenas de cores cinzentas/neutras de texto secundário por toda a app não foram
  auditadas (ver "Não auditado exaustivamente" acima) — candidato a uma tarefa própria
  e dedicada, dado o volume.
- "Manual screen reader" não validado com tecnologia assistiva real.
- `.next-client-time` e os ícones/controlos listados como "deixados como estavam"
  cumprem o limiar aplicável (3:1) mas continuam a usar hex fora da escala de tokens —
  não é uma falha de acessibilidade, só falta de consolidação de tokens (mesma
  categoria de risco já registada em `NEX-151`).

## Próxima tarefa desbloqueada

NEX-155 — Performance e Web Vitals (depende de NEX-151, já concluída).
