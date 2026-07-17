# Evidência — NEX-021 Implementar recuperação de palavra-passe

**Data:** 17 de julho de 2026
**Estado:** concluído

## Implementação

- `src/lib/validation/auth.ts`: `requestPasswordResetSchema` (email), `updatePasswordSchema` (password min. 8 caracteres — mais estrito que o mínimo de 6 do Supabase por omissão).
- `src/features/auth/actions.ts`:
  - `requestPasswordReset`: chama `resetPasswordForEmail` com `redirectTo` **fixo** (`${NEXT_PUBLIC_APP_URL}/definir-password`, nunca derivado de input) e devolve **sempre a mesma resposta de sucesso**, exista ou não o e-mail — não há como um atacante distinguir contas existentes desta chamada.
  - `updatePassword`: `updateUser({ password })` sobre a sessão de recuperação; erro genérico se a sessão não for válida.
- `src/app/(auth)/recuperar-password/page.tsx`: pedido de recuperação, mensagem de confirmação neutra.
- `src/app/(auth)/definir-password/page.tsx`: consome a sessão de recuperação e mostra o formulário de nova password (ver descoberta técnica abaixo).

## Descoberta técnica: fluxo implícito vs. PKCE (`ADR-009`)

Os links de recuperação do Supabase Auth devolvem os tokens no **fragmento da URL** (`#access_token=...&type=recovery`), não num `?code=` explorável pelo servidor — comportamento correto do Supabase, já que PKCE exige estado local do cliente que iniciou o pedido, incompatível com um link de e-mail clicado mais tarde/noutro dispositivo.

`@supabase/ssr` (`createBrowserClient`) força `flowType: "pkce"` de forma **não substituível** (confirmado lendo `node_modules/@supabase/ssr/dist/main/createBrowserClient.js`) — a deteção automática de sessão (`detectSessionInUrl`) nunca reconheceria estes tokens. Corrigido com parsing manual do fragmento + `supabase.auth.setSession()` explícito em `/definir-password`, mantendo a sessão em cookies (compatível com as server actions). Documentado como padrão obrigatório para qualquer fluxo futuro baseado em link de e-mail do Supabase Auth.

## Testes E2E

`tests/e2e/password-recovery.spec.ts`, corrido em `chromium` e `webkit-mobile`:

1. **Anti-enumeração:** pedir recuperação para um e-mail que não existe devolve a mesma mensagem de confirmação que um e-mail real teria.
2. **Fluxo completo:** link real gerado via `admin.generateLink({ type: 'recovery' })` (evita depender de uma caixa de correio real) → define nova password → redirect para `/dashboard` → **reutilizar o mesmo link falha** (mostra "Link inválido ou expirado", confirma token único) → login com a nova password funciona.

**Bugs de teste encontrados e corrigidos** (não do produto):

- `getByLabel('Nova palavra-passe')` era ambíguo por correspondência de substring case-insensitive contra o `aria-label` do formulário ("Definir nova palavra-passe") — corrigido com `{ exact: true }`.
- Uma primeira tentativa usando um `setTimeout` arbitrário para decidir se a sessão estava pronta era frágil; substituída por lógica determinística (sem timeout de adivinhação) assente na resolução da própria chamada `setSession()`.

## Resultado

- `npm run verify`: aprovado (lint apanhou 2 problemas reais no primeiro rascunho — `set-state-in-effect` e uma promise não tratada — ambos corrigidos restruturando o efeito para uma função assíncrona nomeada).
- 10/10 testes E2E aprovados (smoke + login + password-recovery, 2 browsers).
- `ADR-009` publicado.
- Próxima tarefa desbloqueada: `NEX-022`.
