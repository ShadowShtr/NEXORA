# NEX-035 — Passo publicar link e QR Code

## Implementação

- `supabase/migrations/0005_publish_business.sql`: nova função `security definer` `publish_business(p_slug text)`. `tenants` só tem política `SELECT` para `authenticated` (`tenant_read_self`, `0001_initial.sql`) — não existe `UPDATE`. Em vez de abrir uma política de `UPDATE` mais ampla no cliente, a função deriva `tenant_id` de `current_tenant_id()` (a sessão do próprio chamador, nunca de um parâmetro), e atualiza `tenants.slug`, `tenants.status = 'active'` e `business_settings.published_at` (com `coalesce`, para preservar a data original se voltar a publicar depois de editar o slug). Regista `audit_logs` (`business.published`). `EXECUTE` revogado de `public`/`anon`, concedido só a `authenticated` — ao contrário de `provision_tenant_owner` (admin-only), esta função é suposta ser chamada pela sessão normal do dono.
- `src/features/onboarding/domain/publish-step.ts`: `normalizeSlug()` (remove acentos via `normalize('NFD')` + `\p{Diacritic}`, minúsculas, espaços/pontuação → hífens, sem hífens nas pontas), `slugSchema` (Zod, mesmo padrão `^[a-z0-9]+(?:-[a-z0-9]+)*$` do check constraint da BD, 3–60 carateres), `publicBookingUrl()` (`{appUrl}/b/{slug}`, estrutura definida em `docs/01_PRODUCT_REQUIREMENTS.md` #12).
- `src/features/onboarding/PublishStep.tsx`: campo de slug pré-preenchido com o slug atual do tenant (normalizado ao perder o foco), pré-visualização ao vivo do link público, QR Code gerado localmente com a biblioteca `qrcode` (`QRCode.toDataURL`, computação pura no cliente — sem chamar nenhum serviço externo de QR), regenerado a cada alteração do slug. Botões Voltar/Publicar.
- `src/features/onboarding/actions.ts`: `submitPublishStep` normaliza e valida o slug, chama `supabase.rpc('publish_business', ...)`, mapeia `23505` (colisão) para uma mensagem amigável, e em sucesso faz `redirect('/dashboard')` (esta é a última etapa do onboarding).
- `src/app/(onboarding)/onboarding/page.tsx`: passo 5 renderiza `<PublishStep>` com o slug atual do tenant e `NEXT_PUBLIC_APP_URL`. Removido o placeholder genérico "próxima atualização", agora sem uso já que os 5 passos estão implementados.
- `src/app/globals.css`: `.publish-preview`, `.publish-qr`.

## Testes

- `tests/unit/publish-step.test.ts` (8/8 ✅): normalização de slug (acentos, maiúsculas, pontuação); schema Zod aceita/rejeita corretamente; `publicBookingUrl`.
- `tests/integration/publish-business.test.ts` (3/3 ✅, contra a BD real do projeto Supabase de dev): `anon` rejeitado (`42501`); dono publica o próprio tenant (slug, `status=active`, `published_at`, audit log) sem afetar outro tenant; colisão de slug entre tenants devolve `23505`.
- `tests/e2e/onboarding-publish-step.spec.ts` (6/6 ✅ em `chromium` e `webkit-mobile`): Axe 0 violações; preview mostra o link `/b/{slug}` correto; **QR decodificado com `jsqr` + `pngjs` (lendo o `data:image/png;base64` do `<img>`) confirma que codifica exatamente o link público** — critério de aceite central; colisão de slug mostra erro amigável e não avança nem redireciona; publicar ativa o tenant (`status`, `published_at`) e redireciona para `/dashboard`; "Voltar" regressa ao passo 4.
- Regressão: `tests/integration/*` (14 passaram, 2 continuam skip por falta de `TEST_DATABASE_URL`, comportamento pré-existente) e os restantes specs E2E de onboarding (`onboarding-wizard`, `onboarding-business-step`, `onboarding-hours-step`, `onboarding-services-step`, `onboarding-rules-step`, 24/24 ✅) sem regressões.
- `npm run format:write`, `npm run lint`, `npm run typecheck`, `npm run verify` — todos ✅.

## Migração aplicada

`supabase/migrations/0005_publish_business.sql` aplicada ao projeto Supabase de dev (`znakuwpmapkhzuntzorj`) via `supabase db push --db-url ... --yes` (mesma mecânica de `NEX-010`/`NEX-011`, `ADR-007`). Confirmado com `--dry-run` → `"Remote database is up to date"`.

## Resultado

Onboarding completo (5/5 passos). A dona edita e confirma o link público, vê o QR Code gerado localmente e publica com um clique — o tenant fica `active` e visível nas políticas públicas (`public_tenant_lookup`, `public_business_settings`, já existentes desde `NEX-012`).

## Riscos residuais

- Nenhum identificado. A rota pública `/b/{slug}` em si (a página de marcação da cliente) é escopo de uma epic futura (`docs/06_API_CONTRACTS.md` — rotas públicas previstas); esta tarefa só cobre a etapa de onboarding que gera e publica o link/QR.

## Próxima tarefa desbloqueada

NEX-036 — Teste de usabilidade do onboarding (depende de NEX-035, concluída).
