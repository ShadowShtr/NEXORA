# Evidência — NEX-020 Implementar login e logout

**Data:** 17 de julho de 2026
**Estado:** concluído

## Implementação

- `src/lib/validation/auth.ts`: schema Zod (`email`, `password`) no limite da aplicação.
- `src/features/auth/actions.ts`: server actions `login`/`logout`. `login` valida via Zod, chama `supabase.auth.signInWithPassword`, devolve **sempre a mesma mensagem genérica** em caso de erro ("E-mail ou palavra-passe incorretos.") independentemente da causa real (não distingue "utilizador não existe" de "password errada" — evita enumeração de contas). Sucesso → `redirect('/dashboard')` fixo (sem parâmetro `next`, sem superfície de open redirect). `logout` → `signOut()` + `redirect('/login')`.
- `src/app/(auth)/login/page.tsx`: client component com `useActionState`, erro em `<p role="alert" className="form-error">`.
- `src/features/auth/LogoutButton.tsx`: componente reutilizável (form + server action); colocado no dashboard por agora — `NEX-023` vai integrá-lo no shell completo.

## Testes E2E (Playwright)

`tests/e2e/support/provisioned-user.ts`: fixture partilhado que cria um utilizador Auth real **e** o provisiona por completo (tenant + profile + business_settings, via `provision_tenant_owner` de `NEX-013`) — testa o caminho real de login de uma dona já onboarded, não um utilizador Auth "nu". Reutilizável pelas próximas tarefas do épico (`NEX-021`, `NEX-022`, `NEX-023`).

`tests/e2e/login.spec.ts`, corrido em `chromium` e `webkit-mobile` contra o projeto Supabase dev:

- **Falha:** password errada → mensagem de erro genérica visível, sem navegar para fora de `/login`.
- **Sucesso:** credenciais corretas → redirect para `/dashboard`; botão "Sair" → `signOut` + redirect para `/login`.

**Bug de teste encontrado e corrigido:** o primeiro seletor (`getByRole('alert')`) era ambíguo — o `#__next-route-announcer__` do próprio Next.js também tem `role="alert"`, causando falha intermitente conforme o número de workers/browsers em paralelo. Corrigido com seletor mais específico (`[role="alert"].form-error`).

**Correção de configuração:** `next.config.ts` bloqueava por omissão o HMR cross-origin do servidor de dev iniciado pelo Playwright a partir de `127.0.0.1` — adicionado `allowedDevOrigins: ['127.0.0.1']` (só afeta o servidor de desenvolvimento, sem impacto em produção).

## Resultado

- `npm run verify`: aprovado.
- 6/6 testes E2E aprovados (`smoke` + `login`, 2 browsers).
- Limpeza de utilizador/tenant de teste confirmada via fixture (soft delete + remoção do utilizador Auth).

## Risco residual

E2E não corre em CI (`.github/workflows/ci.yml` não tem step `test:e2e`). Corrê-lo em CI exigiria instalar browsers Playwright no runner e configurar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SERVICE_ROLE_KEY` como secrets do GitHub Actions apontando ao projeto Supabase dev — decisão de infraestrutura (secrets partilhados em CI) não tomada sem confirmação explícita do owner. Por agora, E2E corre manualmente (`npm run test:e2e` com `.env.local` carregado).

Próxima tarefa desbloqueada: `NEX-021` e `NEX-022`.
