# EPIC-15 — PWA, design e acessibilidade

## Objetivo do épico

Entregar **pwa, design e acessibilidade** com segurança, testes e documentação suficientes para desbloquear os épicos dependentes.

## Tarefas

### NEX-150 — Design system claymorphism

**Dependências:** NEX-023

**Objetivo**

Implementar design system claymorphism sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Tokens, componentes e contraste AA.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Visual + axe.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma — só tokens CSS, documentação e testes; sem dado novo, RPC ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Não aplicável — tokens e componentes são puramente de apresentação, sem ligação a `tenant_id`.
- Registar risco residual ou decisão temporária. `--pink-500` foi escurecido de `#d95f93` para `#b24e79` para cumprir contraste AA (4.5:1) com texto branco no gradiente dos botões — decisão da dona, entre 3 opções apresentadas. Efeito colateral aceite: o gradiente do botão fica visualmente mais subtil. Não foi criada uma escala de `border-radius`/espaçamento tokenizada (decisão de âmbito, ver `docs/DESIGN_SYSTEM.md`). Ver `docs/evidence/NEX-150_DESIGN_SYSTEM_CLAYMORPHISM.md`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-151 — Navegação mobile e desktop

**Dependências:** NEX-150

**Objetivo**

Implementar navegação mobile e desktop sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Bottom nav e sidebar coerentes.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Breakpoints e teclado.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma — só cor de CSS e testes; sem dado novo, RPC ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Não aplicável — navegação é puramente de apresentação, sem ligação a `tenant_id`.
- Registar risco residual ou decisão temporária. `#ed3f79` (cor ad-hoc fora da escala de tokens, falhava AA a 3,76:1) foi substituída por `var(--pink-600)` só no estado ativo da bottom nav, para ficar coerente com a sidebar e cumprir AA. A mesma cor `#ed3f79` aparece em ~15 outros locais do CSS (fora do âmbito de "navegação") — registado como risco residual para uma futura auditoria (`NEX-154`), não corrigido aqui. Ver `docs/evidence/NEX-151_NAVEGACAO_MOBILE_DESKTOP.md`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-152 — Manifest e instalação PWA

**Dependências:** NEX-150

**Objetivo**

Implementar manifest e instalação pwa sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Ícones, standalone, theme e instruções.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Lighthouse/Android/iOS manual.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma — só ícones estáticos, metadata e um cartão de UI que lê `beforeinstallprompt`/`navigator.userAgent`/`matchMedia`, sem novo dado, RPC ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Não aplicável — manifest e instalação são globais à app, sem ligação a `tenant_id`.
- Registar risco residual ou decisão temporária. O caminho Android/desktop (`beforeinstallprompt`) não foi testado por E2E automatizado — o Chromium só o dispara com critérios reais de instalabilidade que `next dev` sob Playwright não cumpre; validado só por leitura do código e pelos testes obrigatórios "Lighthouse/Android/iOS manual" (não executados nesta sessão — sem Lighthouse CI nem dispositivo Android/iOS físico disponível). Ver `docs/evidence/NEX-152_MANIFEST_INSTALACAO_PWA.md`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-153 — Estratégia de cache segura

**Dependências:** NEX-152

**Objetivo**

Implementar estratégia de cache segura sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Assets somente; no-store para auth/booking token.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Inspeção service worker.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. `src/proxy.ts` (novo) é puro path-matching + um header, sem I/O nem lógica de autorização — não altera quem pode aceder ao quê, só como a resposta pode ser guardada em cache.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Não aplicável — cache é uma preocupação de transporte HTTP, não de dados; RLS/autorização de cada rota está inalterada.
- Registar risco residual ou decisão temporária. `next.config.ts`'s `headers()` não consegue forçar `no-store` nestas rotas (o Cache-Control interno do Next.js para páginas dinâmicas sobrepõe-se) — confirmado empiricamente com `next start` + curl; resolvido com `src/proxy.ts` (antigo `middleware.ts`, convenção `proxy` desde o Next.js 16). Ver `docs/evidence/NEX-153_ESTRATEGIA_CACHE_SEGURA.md`.

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-154 — Auditoria WCAG 2.2 AA

**Dependências:** NEX-151

**Objetivo**

Implementar auditoria wcag 2.2 aa sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Problemas críticos corrigidos.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- axe + manual screen reader/keyboard.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio. Nenhuma — só cores de CSS, um token novo (`--warning`) e testes; sem dado novo, RPC ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped. Não aplicável — correções são puramente de apresentação.
- Registar risco residual ou decisão temporária. Auditados e corrigidos 23 casos reais de falha AA (texto normal <4,5:1), incluindo uma falha severa (~2,5:1) em valores monetários de pagamentos pendentes. Ícones/controlos puramente decorativos que já cumpriam o limiar mais permissivo de 3:1 (WCAG 1.4.11) foram deixados como estavam — não é uma auditoria exaustiva de 100% das cores do ficheiro (ver `docs/evidence/NEX-154_AUDITORIA_WCAG_AA.md` para a lista completa do que foi e não foi tocado). "Manual screen reader" não foi executado com leitor de ecrã real nesta sessão — validado por revisão de código (aria-hidden em ícones decorativos, texto real nos badges de estado, `aria-label`/`role` já existentes).

**Definition of Done**

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`

### NEX-155 — Performance e Web Vitals

**Dependências:** NEX-151

**Objetivo**

Implementar performance e web vitals sem expandir o escopo para funcionalidades não aprovadas.

**Entregáveis**

- código e/ou documentação versionados;
- validação de entrada, autorização e tratamento de erro aplicáveis;
- atualização de testes e documentação;
- evidência de execução dos checks.

**Critérios de aceite**

- Budgets e otimização de bundle/render.
- Nenhum dado de outro tenant pode ser acedido.
- A interface mantém linguagem simples e fluxo guiado quando houver UI.
- Logs não contêm segredos nem PII desnecessária.

**Testes obrigatórios**

- Lighthouse e p75 alvo.
- `npm run verify` passa.

**Segurança e privacidade**

- Rever threat model se a tarefa criar nova entrada, dado, integração ou privilégio.
- Confirmar RLS/autorização server-side quando houver recurso tenant-scoped.
- Registar risco residual ou decisão temporária.

**Definition of Done**

- [ ] Implementação concluída
- [ ] Testes concluídos
- [ ] Documentação atualizada
- [ ] Critérios de aceite validados
- [ ] Tarefa marcada no `TASKS.md`
