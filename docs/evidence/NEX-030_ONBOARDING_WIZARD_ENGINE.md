# Evidência — NEX-030 Criar motor de wizard persistente

**Data:** 17 de julho de 2026
**Estado:** concluído

## Implementação

- `src/features/onboarding/domain/wizard.ts`: lógica pura (sem I/O) — `nextStep`/`previousStep`/`clampStep` com limites 1–5, `STEP_TITLES` com os títulos das 5 etapas reais (`NEX-031`–`NEX-035`).
- `src/features/onboarding/actions.ts`: server actions `goToNextStep`/`goToPreviousStep` — leem e escrevem `business_settings.onboarding_step` do tenant da sessão (via `requireProfile()`), `revalidatePath('/onboarding')` para refletir de imediato.
- `src/app/(onboarding)/onboarding/page.tsx` + `layout.tsx`: página fora do shell principal do dashboard (fluxo focado, uma decisão por ecrã — `CLAUDE.md`), mostra "Passo N de 5", título da etapa, placeholder "em breve", e os botões Voltar/Seguinte condicionais aos limites.
- `src/lib/auth/require-profile.ts`: extraído da lógica que já existia em `(dashboard)/layout.tsx` (`NEX-022`) — agora partilhada entre o layout do dashboard e o do onboarding, evita duplicar a verificação de claims + profile.

## Persistência real (não é estado de cliente)

`onboarding_step` já existia na tabela `business_settings` desde `NEX-001`. Ler/escrever usa o cliente Supabase autenticado normal (não `service_role`) — a política RLS `tenant_id = current_tenant_id()` já garante isolamento entre tenants sem código adicional específico desta tarefa.

## Testes

**Unitários** (`tests/unit/wizard.test.ts`, 6 testes): avançar um passo; não ultrapassar o passo 5; recuar um passo; não recuar antes do passo 1; `clampStep` com valores fora do intervalo (negativos, muito grandes); `STEP_TITLES` tem exatamente 5 entradas.

**E2E** (`tests/e2e/onboarding-wizard.spec.ts`, 3 testes, `chromium` + `webkit-mobile`):

1. Tenant recém-provisionado começa no passo 1, sem botão "Voltar" visível.
2. Avançar um passo e confirmar que **sobrevive a `page.reload()`** e também a uma **reentrada por navegação separada** (`/dashboard` → `/onboarding` de novo) — cobre "refresh/reentrada" do critério de teste.
3. "Voltar" funciona corretamente entre passos intermédios.

## Resultado

- `npm run verify`: aprovado.
- 31/32 testes E2E aprovados (1 skip esperado por design, mobile-only de `NEX-023`). Suite completa: smoke, login, password-recovery, protected-routes, dashboard-shell, onboarding-wizard.
- Próxima tarefa desbloqueada: `NEX-031` (conteúdo real do primeiro passo).
