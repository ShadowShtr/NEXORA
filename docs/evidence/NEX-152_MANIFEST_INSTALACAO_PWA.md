# NEX-152 — Manifest e instalação PWA

## Implementação

- **Bugs reais encontrados nos ícones existentes** (`public/icons/icon-192.png`,
  `icon-512.png`, intocados desde o import inicial do projeto, `NEX-001`): o glifo "N"
  ocupava só uma fração minúscula do canvas (praticamente ilegível a 192px) e usava a
  cor `--pink-500` antiga, já desatualizada desde a correção de contraste da `NEX-150`.
  Regenerados via `sharp` (SVG → PNG) com o gradiente `--pink-500` → `--pink-600`
  atual e um glifo grande e legível.
- **Ícones novos, antes inexistentes**:
  - `icon-maskable-512.png` (`purpose: "maskable"`, adicionado ao `manifest.ts`) — sem
    isto, o Android recorta o ícone "any" existente com a sua própria máscara
    adaptativa, cortando o "N" de forma imprevisível; o maskable mantém o glifo dentro
    da safe zone.
  - `apple-touch-icon.png` (180×180, quadrado sem transparência nem arredondamento — o
    iOS aplica o seu próprio arredondamento e ignora alfa) — o iOS nunca lê
    `manifest.ts`, precisa do seu próprio ícone via `<link rel="apple-touch-icon">`.
- **`theme_color` desatualizado corrigido em dois locais**: `manifest.ts` e
  `layout.tsx` (`viewport.themeColor`) ainda tinham o hex antigo `#d95f93`
  (`--pink-500` pré-`NEX-150`) — atualizado para `#b24e79` nos dois.
- **"Standalone" no iOS, antes inexistente**: `manifest.ts`'s `display: "standalone"`
  não é respeitado pelo Safari/iOS de todo — precisa de `appleWebApp` em
  `layout.tsx`'s `metadata` (gera `mobile-web-app-capable`,
  `apple-mobile-web-app-title` e `-status-bar-style`), agora adicionado.
- **"Instruções", antes inexistentes**: `src/features/shell/InstallAppCard.tsx` (novo),
  integrado na página "Mais" (`/dashboard/mais`, entre "Gestão" e o rodapé). Android/
  desktop Chrome disparam `beforeinstallprompt`, que o cartão captura e usa para
  mostrar um botão "Instalar" que chama `.prompt()` diretamente; o iOS Safari nunca
  dispara esse evento e não tem nenhuma API programática de instalação — o cartão
  mostra antes uma instrução curta ("toque em Partilhar e depois em 'Adicionar ao Ecrã
  Principal'"). Não mostra nada se a app já corre em modo standalone (nada para
  instalar) nem se nenhum dos dois caminhos está disponível (nada acionável para
  mostrar).

## Testes

- `tests/unit/manifest.test.ts` (novo, 3 casos) — `display: standalone`, `theme_color`
  não é o hex antigo, ícone "any" e "maskable" a 512×512 ambos presentes.
- `tests/e2e/pwa-install-card.spec.ts` (novo) — cobre parte do teste obrigatório desta
  tarefa ("iOS manual"): simula o user agent do Safari/iOS
  (`test.use({ userAgent: ... })`) e confirma que aparece a instrução manual sem botão;
  e confirma que, sem iOS nem `beforeinstallprompt` disponível (o caso por omissão num
  browser de desktop comum), o cartão não aparece de todo.
- **Nota**: tal como os restantes specs E2E deste repositório, não corre no CI atual
  (sem job de Playwright configurado). Não foi possível correr localmente por falta de
  Docker/WSL2 (`ADR-007`) — revisão por leitura cuidada do código.
- **Verificação manual com o servidor de desenvolvimento** (`npm run dev` + `curl`):
  confirmado que `/manifest.webmanifest` serve o `theme_color`/ícones novos, que
  `/icons/icon-maskable-512.png` é servido com `200 OK`, e que o `<head>` de `/login`
  contém `<meta name="theme-color" content="#b24e79">`,
  `<meta name="mobile-web-app-capable" content="yes">`,
  `<meta name="apple-mobile-web-app-title" content="NEXORA">`,
  `<link rel="icon">` e `<link rel="apple-touch-icon">` corretos.
- **Não executado**: Lighthouse PWA audit e instalação manual num dispositivo
  Android/iOS físico (teste obrigatório desta tarefa) — sem Lighthouse CI configurado
  nem dispositivo físico disponível nesta sessão. Registado como risco residual.
- `npm run verify` (format, lint, typecheck, 419 testes, build) — ✅.

## Resultado

A app passa a ter um manifest PWA coerente com o design system corrigido (`NEX-150`),
ícones legíveis e corretos para Android (incl. maskable) e iOS, comportamento
standalone real no iOS, e um caminho de instalação visível e guiado para a dona em
ambas as plataformas — nada disto existia de forma funcional antes desta tarefa.

## Riscos residuais

- Lighthouse PWA audit e teste manual em dispositivo Android/iOS físico não executados
  — validado só por leitura de código, testes automatizados e inspeção do HTML/manifest
  servidos por `next dev`.
- O caminho `beforeinstallprompt` (Android/desktop) não tem cobertura E2E automatizada
  — o Chromium só o dispara com critérios reais de instalabilidade (service worker,
  HTTPS/localhost, manifest válido) que este ambiente de teste não cumpre.
- `#ed3f79`/outras cores ad-hoc fora da escala de tokens (já registado como risco em
  `NEX-151`) continuam por resolver — não revisitado aqui.

## Próxima tarefa desbloqueada

NEX-153 — Estratégia de cache segura (depende de NEX-152, agora concluída).
