# Design system — claymorphism (NEX-150)

Fonte de verdade visual: `src/app/globals.css` (tokens em `:root`) e os componentes em
`src/components/ui/`. Este documento é um mapa de leitura, não uma cópia — os valores
reais vivem sempre no CSS/TSX; se divergirem, o código manda.

As regras de fidelidade obrigatória por página (Agenda, Clientes, Serviços, Mais,
Início) estão em `CLAUDE.md`, não aqui — este documento cobre o que é comum a todas:
tokens, sombras, tipografia e componentes reutilizáveis.

## Princípios (de `CLAUDE.md`)

- Claymorphism moderno: sombra dupla (clara + escura) simulando relevo suave, nunca
  bordas duras nem sombras únicas planas.
- Paleta: rosa médio, rosa muito claro e branco. Feminino e premium, nunca infantil.
- Botões grandes, linguagem direta, uma decisão importante por ecrã.
- Responsivo mobile-first; desktop amplia, não duplica.
- Nunca sacrificar contraste, foco visível ou legibilidade em nome do estilo.

## Tokens de cor (`:root` em `globals.css`)

| Token            | Valor                       | Uso típico                                                                          |
| ---------------- | --------------------------- | ----------------------------------------------------------------------------------- |
| `--pink-50`      | `#fff8fb`                   | Fundo geral da app, cartões claros                                                  |
| `--pink-100`     | `#fdebf3`                   | Bordas subtis, fundos de destaque leve                                              |
| `--pink-300`     | `#ef9fc0`                   | Bordas de foco/seleção, acentos decorativos                                         |
| `--pink-500`     | `#b24e79`                   | Rosa médio — gradientes com texto/ícone branco, texto de destaque sobre fundo claro |
| `--pink-600`     | `#bd4179`                   | Rosa mais escuro — ponta escura dos gradientes, texto de ênfase                     |
| `--text`         | `#362b31`                   | Texto principal                                                                     |
| `--muted`        | `#74656d`                   | Texto de apoio (`.text-support`)                                                    |
| `--success`      | `#24805b`                   | Estados positivos (ex.: marcação concluída)                                         |
| `--danger`       | `#b9344a`                   | Erros de formulário, estados negativos (falta, atraso)                              |
| `--warning`      | `#975c10`                   | Estados de aviso/pendente (ex.: pagamento pendente) — NEX-154                       |
| `--shadow-dark`  | `rgba(153, 86, 114, 0.16)`  | Sombra escura do relevo claymorphism                                                |
| `--shadow-light` | `rgba(255, 255, 255, 0.95)` | Sombra clara do relevo claymorphism                                                 |

**Nota sobre `--pink-500` (NEX-150):** o valor original (`#d95f93`) falhava o contraste
AA (4.5:1) para texto branco normal sobre o gradiente
`linear-gradient(145deg, var(--pink-500), var(--pink-600))` usado em `.button`,
avatares com iniciais e no separador ativo — na ponta mais clara do gradiente o rácio
era ~3,49:1. Escurecido para `#b24e79` (decisão da dona, ver
`docs/evidence/NEX-150_DESIGN_SYSTEM_CLAYMORPHISM.md`), o que também corrigiu o mesmo
problema onde `--pink-500` era usado como cor de texto sobre fundo branco/`--pink-50`
(ex.: `.client-total-value`). Efeito colateral aceite: o gradiente do botão fica
visualmente mais subtil (as duas pontas ficam mais próximas em luminância), já que
qualquer tom claro o suficiente para parecer "médio" falha AA com texto branco de 16px.

Não existe uma escala tokenizada de `border-radius`/espaçamento — cada componente usa o
valor que a referência visual da página pede (`CLAUDE.md`); tokenizar isso não traria
benefício de acessibilidade e arriscava uma reescrita visual não pedida, por isso foi
deixado fora do âmbito desta tarefa.

## Verificação de contraste AA

`tests/unit/design-tokens-contrast.test.ts` lê os tokens diretamente de
`globals.css` (não uma cópia) e confirma ≥4.5:1 para todos os pares
texto/fundo realmente usados na app. Qualquer alteração futura a um destes tokens que
quebre o contraste falha este teste, não só uma auditoria manual.
`src/lib/color-contrast.ts` expõe `contrastRatio()` como função pura, testada
separadamente contra os pares de referência da própria WCAG (preto/branco = 21:1).

**NEX-154 — auditoria e correção de cores ad-hoc:** além dos tokens em `:root`, o
ficheiro tinha ~25 cores hexadecimais soltas (fora da escala de tokens) usadas como
texto ou fundo de gradiente com texto branco, a maioria variações próximas de
`--pink-600` ou de um vermelho "perigo" nunca formalizado. Auditadas uma a uma
(contraste real calculado contra o fundo efetivo de cada uma, não só branco) —
confirmadas 23 falhas reais de AA para texto normal, das quais uma severa (~2,5:1, o
laranja de "pagamento pendente", pior que todas as outras). Todas corrigidas,
substituindo por `var(--pink-600)`, `var(--danger)` ou pelo novo `var(--warning)`
consoante o significado semântico de cada uso (não trocado às cegas — "atrasado"/
"negativo" mantém-se vermelho-perigo, "pendente"/link/acento mantém-se rosa). Ícones e
elementos puramente decorativos que já cumpriam o limiar mais permissivo de 3:1 (WCAG
1.4.11) foram deixados como estavam. Detalhe completo em
`docs/evidence/NEX-154_AUDITORIA_WCAG_AA.md`.

## Componentes reutilizáveis (`src/components/ui/`)

| Componente    | Ficheiro          | Propósito                                                                                                                                                                  |
| ------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`      | `Button.tsx`      | Botão primário (gradiente rosa) e secundário (contorno), variante única de foco visível partilhada.                                                                        |
| `Card`        | `Card.tsx`        | Cartão com relevo claymorphism (sombra dupla), contentor base de quase todas as páginas do dashboard.                                                                      |
| `BottomSheet` | `BottomSheet.tsx` | Painel deslizante a partir do fundo (mobile-first), usado para ações que não podem expandir o cartão de origem (ex.: conclusão de marcação — regra obrigatória da Agenda). |
| `HelpTip`     | `HelpTip.tsx`     | Ajuda contextual sob demanda (NEX-144) — ícone "?" que revela uma frase curta, sem tour obrigatório.                                                                       |

## Testes de acessibilidade automatizados (axe)

Todas as páginas cobertas por specs E2E correm `@axe-core/playwright` e exigem zero
violações. NEX-150 acrescentou cobertura às três páginas com secção de "fidelidade
obrigatória" própria em `CLAUDE.md` que ainda não tinham nenhum teste de
acessibilidade: Agenda, Clientes e Mais (`tests/e2e/design-system-axe.spec.ts`). Início
e Serviços já estavam cobertas (`dashboard-shell.spec.ts`, `catalog-*.spec.ts`).

Como todos os outros specs E2E deste repositório, estes não correm no CI atual (sem job
de Playwright configurado) — mesma limitação pré-existente registada desde `NEX-140`.
