# NEXORA — Design System Pixel-Perfect

## 1. Objetivo

Este documento é a fonte técnica obrigatória para reproduzir a interface da NEXORA com máxima fidelidade às imagens em `docs/references/`.

A implementação não deve ser apenas inspirada nas referências. Deve reproduzir a composição, hierarquia, densidade, proporções, cores, espaçamentos, tipografia, estados e comportamento percebido.

## 2. Ordem de autoridade visual

Em caso de conflito, seguir esta ordem:

1. imagem de referência correspondente ao ecrã;
2. especificação individual em `docs/ui-specs/`;
3. tokens deste documento;
4. regras gerais de acessibilidade e responsividade;
5. decisão de implementação documentada em ADR.

Não alterar a composição sem documentar a razão.

## 3. Viewports oficiais

### Referência primária móvel

- largura CSS: `390px`;
- altura CSS: `844px`;
- device scale factor: `1` nos testes visuais;
- orientação: portrait;
- browser de referência: Chromium via Playwright.

### Viewports secundárias

- móvel grande: `430 × 932`;
- tablet: `768 × 1024`;
- desktop: `1440 × 1024`;
- desktop largo: `1600 × 1000`.

A versão móvel de `390 × 844` define a aparência principal. Tablet e desktop devem preservar a linguagem visual, não simplesmente esticar a versão móvel.

## 4. Grid e geometria

### Sistema base

- unidade mínima: `4px`;
- espaçamento padrão entre elementos relacionados: `8px`;
- espaçamento entre cartões: `12px`;
- espaçamento entre secções: `20px` ou `24px`;
- margem lateral móvel: `16px`;
- margem lateral tablet: `24px`;
- margem de conteúdo desktop: `32px`;
- largura máxima de conteúdo desktop: `1440px`.

### Safe areas

Utilizar:

```css
padding-top: max(12px, env(safe-area-inset-top));
padding-bottom: max(12px, env(safe-area-inset-bottom));
```

A barra inferior deve respeitar `env(safe-area-inset-bottom)`.

## 5. Tokens de cor

```css
:root {
  --nx-primary-50: #fff4f8;
  --nx-primary-100: #ffe7f0;
  --nx-primary-200: #ffcfe0;
  --nx-primary-300: #ffa9c7;
  --nx-primary-400: #ff78a6;
  --nx-primary-500: #ff3f7f;
  --nx-primary-600: #ed2869;
  --nx-primary-700: #ca1b56;

  --nx-surface: #ffffff;
  --nx-surface-soft: #fff9fb;
  --nx-surface-muted: #f9f5f7;
  --nx-background: #fffafb;

  --nx-text-strong: #1f1f24;
  --nx-text: #38343a;
  --nx-text-muted: #77717a;
  --nx-text-subtle: #a19aa2;

  --nx-border: #f0e7eb;
  --nx-border-strong: #e2d5db;

  --nx-success: #42b883;
  --nx-success-soft: #ecf9f2;
  --nx-warning: #f5a623;
  --nx-warning-soft: #fff7e8;
  --nx-danger: #ef5350;
  --nx-danger-soft: #fff1f1;
  --nx-info: #5b8def;
  --nx-info-soft: #eef5ff;
}
```

### Gradiente primário

```css
background: linear-gradient(135deg, #ff3f7f 0%, #ff6f9f 56%, #ff9abb 100%);
```

### Gradiente de superfície

```css
background: linear-gradient(145deg, #ffffff 0%, #fff6f9 100%);
```

### Fundo geral

```css
background:
  radial-gradient(circle at 92% 4%, rgba(255, 111, 159, 0.1), transparent 28%),
  linear-gradient(180deg, #fffafb 0%, #ffffff 45%, #fff8fb 100%);
```

## 6. Tipografia

### Fontes

- títulos, marca e botões: `Poppins`;
- textos operacionais, formulários, horários e valores: `Inter`.

Carregar via `next/font/google` com versões fixas no lockfile.

```ts
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-heading',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});
```

### Escala móvel

| Token       | Tamanho | Linha | Peso | Uso                          |
| ----------- | ------: | ----: | ---: | ---------------------------- |
| display     |    30px |  36px |  700 | total financeiro principal   |
| h1          |    24px |  30px |  700 | títulos de páginas especiais |
| h2          |    20px |  26px |  700 | título de página             |
| h3          |    16px |  22px |  600 | título de cartão             |
| body        |    14px |  20px |  400 | texto normal                 |
| body-medium |    14px |  20px |  500 | labels e ações               |
| small       |    12px |  17px |  400 | metadados                    |
| micro       |    10px |  14px |  500 | navegação inferior           |
| money-lg    |    22px |  28px |  700 | valores destacados           |
| time-lg     |    20px |  26px |  700 | horários principais          |

Não utilizar menos de `10px` em conteúdo funcional.

## 7. Raios

```css
--nx-radius-xs: 8px;
--nx-radius-sm: 12px;
--nx-radius-md: 16px;
--nx-radius-lg: 20px;
--nx-radius-xl: 24px;
--nx-radius-2xl: 28px;
--nx-radius-pill: 999px;
```

Aplicação:

- inputs: `12px`;
- botões: `14px`;
- cartões pequenos: `16px`;
- cartões principais: `20px`;
- modais: `24px`;
- cabeçalhos decorativos: `24–28px`;

## 8. Bordas

Borda padrão:

```css
border: 1px solid rgba(240, 231, 235, 0.95);
```

Estado selecionado:

```css
border: 1px solid var(--nx-primary-500);
```

Nunca usar bordas pretas. As divisórias devem ser `#f0e7eb` com opacidade entre `0.7` e `1`.

## 9. Sombras e claymorphism

### Cartão comum

```css
box-shadow:
  0 6px 18px rgba(33, 20, 26, 0.055),
  0 1px 3px rgba(33, 20, 26, 0.035);
```

### Cartão elevado

```css
box-shadow:
  0 12px 30px rgba(255, 63, 127, 0.11),
  0 4px 10px rgba(33, 20, 26, 0.055);
```

### Botão primário

```css
box-shadow: 0 8px 18px rgba(255, 63, 127, 0.24);
```

### Claymorphism suave

```css
box-shadow:
  7px 7px 18px rgba(222, 211, 216, 0.58),
  -7px -7px 18px rgba(255, 255, 255, 0.92);
```

Claymorphism deve ser discreto. Não criar relevo excessivo.

## 10. Botões

### Primário

- altura: `48px`;
- raio: `14px`;
- padding horizontal: `20px`;
- fonte: Poppins `14px/600`;
- texto branco;
- largura total quando for ação final.

```css
background: linear-gradient(135deg, #ff3f7f, #ff6f9f);
```

### Secundário

- altura: `46px`;
- fundo branco;
- borda `#ff6f9f`;
- texto `#ff3f7f`.

### Destrutivo

- fundo `#fff1f1` ou branco;
- borda `#ef5350`;
- texto `#ef5350`;
- confirmação obrigatória em ações irreversíveis.

### Estados

- hover desktop: `translateY(-1px)`;
- active/touch: `scale(0.98)`;
- disabled: opacidade `0.48`, sem sombra;
- loading: texto preservado sempre que possível e spinner de `16px`.

## 11. Inputs

- altura: `48px`;
- raio: `12px`;
- padding: `0 14px`;
- label: `12px/500`;
- erro: texto `12px`, vermelho;
- foco: ring de `3px rgba(255,63,127,.10)`.

Textarea:

- altura mínima `92px`;
- padding `12px 14px`;
- resize desativado em móvel.

## 12. Cartões

### Cartão base

- fundo branco;
- raio `18px`;
- padding `14px` ou `16px`;
- borda clara;
- sombra suave.

### Cartão de agenda

- altura mínima `84px`;
- grid: horário `54px`, conteúdo flexível, ações `70px`;
- raio `16px`;
- gap interno `8px`.

### Cartão métrico

- altura mínima `82px`;
- título `11–12px`;
- valor `18–22px`;
- ícone opcional `18px`.

## 13. Ícones

Biblioteca única: `lucide-react`.

- stroke padrão: `1.8`;
- pequeno: `16px`;
- normal: `20px`;
- navegação: `22px`;
- ação principal: `24px`.

Não misturar conjuntos de ícones.

## 14. Navegação inferior

- altura visual: `64px`;
- altura total com safe area: `64px + env(safe-area-inset-bottom)`;
- 5 itens;
- fundo branco com blur;
- ícone `22px`;
- label `10px/500`;
- ativo rosa;
- inativo cinzento.

## 15. Animações

### Curvas

- padrão: `cubic-bezier(0.22, 1, 0.36, 1)`;
- rápida: `160ms`;
- padrão: `220ms`;
- entrada de página: `280ms`;
- confirmação: `450–700ms`.

### Entrada de página

```css
@keyframes nx-page-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Modal

```css
@keyframes nx-modal-enter {
  from {
    opacity: 0;
    transform: scale(0.965) translateY(12px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
```

### Conclusão

- círculo escala `0.72 → 1.08 → 1`;
- check desenhado por stroke;
- cartão muda para sucesso em `300ms`;
- totais financeiros atualizam com transição numérica.

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## 16. Loading e estados vazios

Utilizar skeleton, nunca bloquear toda a aplicação com spinner grande.

Skeleton:

```css
background: linear-gradient(90deg, #f5eff2 25%, #fff8fa 50%, #f5eff2 75%);
background-size: 200% 100%;
animation: nx-shimmer 1.25s linear infinite;
```

Estados vazios devem ter:

- ícone `40–48px`;
- título `16px/600`;
- descrição `13px`;
- uma ação principal.

## 17. Acessibilidade

- WCAG 2.2 AA como mínimo;
- alvo de toque `44 × 44px`;
- foco visível;
- estados não dependem apenas de cor;
- labels reais em inputs;
- `aria-live` para confirmações e erros;
- navegação por teclado no desktop;
- ordem de foco consistente;
- contraste validado no CI.

## 18. Regra pixel-perfect

Uma página só pode ser concluída quando:

- comparação visual foi executada;
- não há alteração percetível na composição;
- alinhamento principal tem tolerância máxima de `2px`;
- dimensões de componentes principais têm tolerância máxima de `2px`;
- tipografia principal tem tolerância máxima de `1px`;
- `maxDiffPixelRatio <= 0.01` em screenshot estável;
- diferenças inevitáveis foram documentadas.
