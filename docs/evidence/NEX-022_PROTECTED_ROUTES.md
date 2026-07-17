# Evidência — NEX-022 Proteger rotas privadas

**Data:** 17 de julho de 2026
**Estado:** concluído

## Implementação — duas camadas de defesa

1. **`src/lib/supabase/proxy.ts`**: já corria `getClaims()` para refrescar o token (`NEX-001`), mas não bloqueava nada. Adicionada uma allowlist de rotas públicas (`/`, `/login`, `/recuperar-password`, `/definir-password`, `/api/health`); qualquer outra rota sem `claims` válidas é redirecionada para `/login`, preservando os cookies que o próprio `getClaims()` possa ter atualizado/limpo.
2. **`src/app/(dashboard)/layout.tsx`** (novo): revalida `getClaims()` no servidor — nunca confia que o proxy já verificou (defesa em profundidade, `CLAUDE.md`: "Autorize no servidor"). Depois verifica se existe `profiles` para esse `user_id` (leitura sob RLS, `profile_read_self`); sem `profile`, faz `signOut()` e redireciona para `/login?error=no_profile` com mensagem visível. A verificação de `profile` fica só no layout do dashboard (não no proxy), para não pagar uma leitura à BD em todas as requisições — só nas rotas que realmente precisam.

`/definir-password` fica deliberadamente na allowlist pública: a sessão de recuperação só é estabelecida **no cliente** depois da página carregar (`NEX-021`), pelo que bloqueá-la a nível de proxy impediria sempre o próprio fluxo de recuperação de funcionar.

## Bug de build encontrado e corrigido

`next build` falhou com `useSearchParams() should be wrapped in a suspense boundary` na página de login — não aparecia em `next dev` (mais tolerante), só na pré-renderização estática de produção. Corrigido isolando a leitura de `searchParams` num componente `NoProfileNotice` envolvido em `<Suspense>`. Efeito colateral correto observado: `/dashboard` passou de rota estática (`○`) a dinâmica (`ƒ`) no output do build — confirma que a proteção agora depende mesmo de estado do pedido (cookies), não é pré-computável.

## Testes E2E — sessão falsificada

`tests/e2e/protected-routes.spec.ts`, corrido em `chromium` e `webkit-mobile`:

1. **Sem sessão:** aceder a `/dashboard` diretamente → redirect para `/login`.
2. **Cookie de sessão adulterado:** login real (sessão válida) → substitui o valor de todos os cookies `sb-*` por lixo → tenta aceder a `/dashboard` de novo → redirect para `/login` (a sessão forjada não é aceite).
3. **Sessão válida sem `profile`:** cria um utilizador Auth "nu" (sem `provision_tenant_owner`) → login com credenciais corretas sucede → layout do dashboard deteta ausência de `profile`, expulsa e redireciona com `?error=no_profile` e mensagem visível.

## Resultado

- `npm run verify`: aprovado.
- 16/16 testes E2E aprovados (suite completa: smoke, login, password-recovery, protected-routes; 2 browsers).
- Próxima tarefa desbloqueada: `NEX-023`.
