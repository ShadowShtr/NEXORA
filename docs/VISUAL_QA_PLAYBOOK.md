# NEXORA — Playbook de QA Visual

## 1. Objetivo

Garantir que cada ecrã implementado reproduza as referências com fidelidade visual estável, responsiva e acessível.

## 2. Processo obrigatório por ecrã

1. localizar a referência correspondente;
2. identificar viewport e crop;
3. medir margens e componentes principais;
4. implementar apenas esse ecrã ou vertical slice;
5. usar dados de fixture determinísticos;
6. desativar animações no teste;
7. capturar screenshot;
8. gerar diff;
9. corrigir divergências;
10. validar teclado, toque, responsividade e contraste;
11. atualizar snapshot somente após revisão humana.

## 3. Ambiente determinístico

- timezone: `Europe/Lisbon`;
- locale: `pt-PT`;
- datas fixas em testes;
- fontes carregadas antes da captura;
- nenhuma chamada externa real;
- avatares e imagens locais;
- service worker desativado em testes visuais;
- animações desativadas;
- cursor/caret ocultos.

## 4. Playwright config

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/visual',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-390',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'mobile-430',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 430, height: 932 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'desktop-1440',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1024 },
      },
    },
  ],
});
```

## 5. Teste de screenshot

```ts
import { expect, test } from '@playwright/test';

test('dashboard mobile pixel-perfect', async ({ page }) => {
  await page.goto('/__visual/dashboard');
  await page.evaluate(() => document.fonts.ready);

  await expect(page).toHaveScreenshot('dashboard-mobile.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    maxDiffPixelRatio: 0.01,
  });
});
```

## 6. Fixtures visuais

Criar rotas protegidas apenas em desenvolvimento/teste:

```text
/__visual/dashboard
/__visual/agenda
/__visual/appointment-details
/__visual/checkout-quick
/__visual/checkout-expanded
/__visual/clients
/__visual/client-profile
/__visual/services
/__visual/finance
/__visual/settings
/__visual/public-booking
```

Essas rotas devem usar dados estáticos e nunca estar disponíveis em produção.

## 7. Critérios de aprovação

### Estrutura

- principais caixas e cartões dentro de `2px`;
- margens laterais dentro de `1–2px`;
- barra inferior e cabeçalhos alinhados;
- nenhuma quebra inesperada de texto.

### Tipografia

- família correta;
- peso correto;
- tamanho com diferença máxima de `1px`;
- line-height visualmente equivalente.

### Cores

- tokens exatos;
- gradientes com os mesmos pontos;
- sombras sem saturação excessiva.

### Interação

- estados hover/focus/touch;
- loading;
- erro;
- vazio;
- disabled;
- sucesso;
- reduced motion.

## 8. Atualização de snapshots

É proibido executar atualização global de snapshots para fazer o CI passar sem inspeção.

Procedimento:

1. abrir imagem esperada;
2. abrir imagem atual;
3. abrir diff;
4. confirmar mudança intencional;
5. anexar screenshots ao PR;
6. obter aprovação;
7. atualizar snapshot específico.

## 9. Ferramentas opcionais

- Playwright snapshots;
- `pixelmatch`;
- `pngjs`;
- Storybook ou Ladle para componentes isolados;
- Chromatic somente se houver orçamento;
- axe-core para acessibilidade.

## 10. Checklist por PR de UI

- [ ] referência identificada;
- [ ] viewport correto;
- [ ] tokens reutilizados;
- [ ] nenhuma cor hardcoded sem justificativa;
- [ ] screenshot móvel anexada;
- [ ] screenshot desktop anexada quando aplicável;
- [ ] diff visual dentro do limite;
- [ ] teclado e foco testados;
- [ ] touch targets >= 44px;
- [ ] reduced motion testado;
- [ ] loading, vazio e erro implementados;
- [ ] snapshots aprovados conscientemente.
