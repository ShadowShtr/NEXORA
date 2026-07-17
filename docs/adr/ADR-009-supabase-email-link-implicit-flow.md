# ADR-009 — Links de e-mail do Supabase Auth usam fluxo implícito, não PKCE

## Estado

Aceite

## Contexto

Ao implementar a recuperação de palavra-passe (`NEX-021`), o link gerado por `resetPasswordForEmail`/`admin.generateLink({ type: 'recovery' })` redireciona para a app com os tokens no **fragmento da URL** (`#access_token=...&refresh_token=...&type=recovery`), nunca num `?code=` explorável pelo servidor. Isto faz sentido estruturalmente: PKCE exige que o mesmo cliente que iniciou o pedido guarde um `code_verifier` local antes de o link ser clicado — um pedido de recuperação por e-mail é, por definição, iniciado num contexto (servidor, ou outro dispositivo) que não tem garantia de ser o mesmo que abre o link mais tarde, pelo que o Supabase usa o fluxo implícito para este caso, independentemente da configuração do cliente que fez o pedido.

O obstáculo: `@supabase/ssr`, usado em `src/lib/supabase/client.ts` (`createBrowserClient`), define `flowType: "pkce"` de forma **não substituível** — a opção do utilizador é espalhada antes do valor fixo no objeto de configuração (`node_modules/@supabase/ssr/dist/main/createBrowserClient.js`), pelo que passar `flowType: 'implicit'` é silenciosamente ignorado. Como consequência, a deteção automática de sessão a partir do URL (`detectSessionInUrl`) nunca reconhece tokens no fragmento — só painéis com `?code=`.

## Opções

1. Usar `@supabase/supabase-js` puro (sem `@supabase/ssr`) só para a página que consome o link — resolve a deteção automática, mas a sessão fica em `localStorage`, não em cookies, e o resto da app (incluindo as server actions) não a consegue ler.
2. Fazer parsing manual do fragmento (`access_token`, `refresh_token`, `type`) e chamar `supabase.auth.setSession(...)` explicitamente no cliente `@supabase/ssr` — bypassa a deteção automática, mas usa o mesmo storage (cookies) que o resto da app já espera.
3. Reportar como bug a montante em `@supabase/ssr` e esperar por correção — bloqueia a tarefa indefinidamente.

## Decisão

Opção 2. `src/app/(auth)/definir-password/page.tsx` extrai `access_token`/`refresh_token` de `window.location.hash` manualmente e chama `setSession()` no cliente `@supabase/ssr` normal — a sessão fica corretamente em cookies, legível pelas server actions (`updatePassword`). Limpa o fragmento do URL (`history.replaceState`) depois de consumido.

**Qualquer funcionalidade futura que dependa de um link de e-mail do Supabase Auth** (confirmação de convite, magic link, etc.) **deve seguir o mesmo padrão** — nunca assumir que `detectSessionInUrl` vai funcionar nestas páginas.

## Consequências positivas

- Recuperação de password funcional, sessão coerente com o resto da app (cookies).
- Padrão documentado e reutilizável para qualquer página futura que consuma um link de e-mail do Supabase Auth.

## Consequências negativas

- Mais código manual do que o esperado da API "automática" do SDK.
- Se o Supabase (ou `@supabase/ssr`) mudar este comportamento numa versão futura, este parsing manual pode ficar redundante ou, pior, conflituar — rever ao atualizar `@supabase/ssr`.

## Segurança e privacidade

Sem impacto negativo: `setSession` valida os tokens no servidor de Auth do Supabase como qualquer outro fluxo; o parsing manual só extrai valores já presentes no URL que o browser já tem. O fragmento é removido do histórico do browser imediatamente após o consumo, reduzindo exposição em back/forward ou logs de navegação do browser.
