# NEX-202 — Tokenizar espaçamento, radius e elevação

## Objetivo

Introduzir a escala de tokens de espaçamento e radius proposta pelo plano
mestre (`NEXORA_PLANO_MESTRE_CONSTRUCAO_UI_SEM_CUSTOS.md`, §5.2) em
`globals.css`, **sem alterar nenhum pixel do visual já aprovado**.

## Implementação

Adicionados a `:root` em `src/app/globals.css`:

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--radius-sm: 12px;
--radius-md: 16px;
--radius-lg: 20px;
--radius-xl: 24px;
--radius-sheet: 28px;
--radius-pill: 999px;
```

Aplicados aos 3 componentes partilhados reais que existem hoje como tal
(`src/components/ui/`) e às classes CSS que já partilham exatamente os
mesmos valores:

- **`Button`** (`.button`) — `border-radius: 1rem` (16px) → `var(--radius-md)`.
- **`Card`** (`.card`) e **`.appointment-card`** (mesmo padrão visual,
  historicamente duplicado em vez de reutilizar `Card`) — `border-radius:
1.5rem` (24px) → `var(--radius-xl)`; `padding: 1.25rem` (20px) →
  `var(--space-5)`.
- **`BottomSheet`** (`.bottom-sheet`) e **`.completion-sheet`** (usada por
  `CompletionSheet.tsx`, mesmo padrão visual que `BottomSheet` mas ainda não
  consolidada no componente genérico) — `border-radius: 1.75rem 1.75rem 0 0`
  (28px) → `var(--radius-sheet) var(--radius-sheet) 0 0`; a parte do
  `padding` em `1.25rem` (20px) → `var(--space-5)` (a parte em `0.65rem`
  ficou como estava — ver limitações abaixo).
- **`FilterChip`** (`.filter-chip`, já existe como classe própria, usada em
  Clientes) — `border-radius: 999px` → `var(--radius-pill)`.

Zero mudança de valor computado em qualquer dos casos acima — só troca do
literal pelo token equivalente.

## Limitações encontradas — não forçadas para não alterar o visual

- **`PageHeader`**: não existe como componente reutilizável neste código —
  cada página (Início, Agenda, Clientes, …) implementa o seu próprio cabeçalho
  inline (`.home-header`, `.agenda-title`, `.public-header`, …), sem uma
  classe/valor de espaçamento ou radius comum a tokenizar. Formalizar um
  componente `PageHeader` partilhado é trabalho de UI maior, fora do âmbito
  desta tarefa (só tokens) — candidato natural a uma tarefa futura de
  consolidação de componentes (`§5.4` do plano mestre já lista `PageHeader`
  como componente a criar/reutilizar).
- **`MetricCard`**: o padrão mais próximo existente é `.summary-card` (grid
  2×2 do Início). Os seus valores reais — `border-radius: 18px`, `padding:
14px` — não coincidem com nenhum token da escala proposta (16 ou 20 para
  radius, 12 ou 16 para espaçamento). Ajustá-los para o token mais próximo
  mudaria o visual em 1–2px, o que a tarefa proíbe explicitamente. Mantidos
  como estavam; a decisão de snap para a escala (aceitando a mudança
  mínima) ou de formalizar um alias de token para este valor específico
  fica para uma tarefa de UI futura com aprovação visual explícita.
- **`.bottom-sheet`/`.completion-sheet`**: o `0.65rem` (10.4px) da parte
  superior do padding não corresponde a nenhum token da escala (mais
  próximo seria `--space-3`, 12px) — mantido como estava pela mesma razão.

Nenhum destes casos foi escondido — todos documentados aqui e como
comentário em `globals.css` junto à definição dos tokens.

## Testes obrigatórios

- **Comparação visual antes/depois**: as substituições feitas são trocas
  1:1 de valor idêntico (`1rem` → `var(--radius-md)` onde ambos resolvem
  para 16px, etc.) — não há mudança de pixel a verificar visualmente;
  confirmado por inspeção dos valores antes de cada substituição (não por
  captura de ecrã, dado que o resultado computado é bit-a-bit idêntico).
- `npm run verify` passa (build, lint, format, types, testes, bundle
  budget) — confirma que a sintaxe CSS/`var()` é válida e nenhum teste
  visual/snapshot quebrou.

## Definition of Done

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados — sem perda de fidelidade, tokens aplicados onde os valores batem certo, limitações documentadas
- [x] Tarefa marcada no `TASKS.md`
