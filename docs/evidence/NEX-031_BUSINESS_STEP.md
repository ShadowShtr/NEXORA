# Evidência — NEX-031 Passo negócio e morada fixa

**Data:** 17 de julho de 2026
**Estado:** concluído

## Implementação

- `src/lib/phone.ts`: `normalizePhoneE164` — normaliza números locais (Portugal por omissão) e internacionais já em E.164; sem dependência externa de parsing de telefone (produto focado em Portugal, `CLAUDE.md`: não introduzir dependências sem necessidade demonstrada).
- `src/lib/maps-url.ts`: `isSafeMapsUrl` — só aceita `https://` para uma allowlist de anfitriões conhecidos (`maps.google.com`, `goo.gl`, `maps.app.goo.gl`, `maps.apple.com`, e `google.com`/`www.google.com` só sob `/maps`). Este link é mostrado diretamente às clientes na página pública (`NEX-073`), por isso não pode aceitar URL arbitrário.
- `src/features/onboarding/domain/business-step.ts`: schema Zod completo do passo (nome, telefone, e-mail opcional, morada, código postal, localidade, link de Maps opcional).
- `src/features/onboarding/actions.ts` → `submitBusinessStep`: valida, normaliza telefone, grava em `business_settings` **e avança o passo na mesma escrita** (não são duas ações separadas).
- `src/features/onboarding/BusinessStep.tsx`: formulário real que substitui o placeholder genérico do passo 1 (`NEX-030`); passos 2–5 continuam com o placeholder + Voltar/Seguinte genéricos até às tarefas seguintes.

## Testes

**Unitários:** `tests/unit/phone.test.ts` (6) — prefixo de país, remoção de espaços/pontos/traços, E.164 já formatado passa inalterado, conversão de prefixo `00`, remoção de zero de tronco, input vazio/curto devolve `null`. `tests/unit/maps-url.test.ts` (5) — anfitriões conhecidos aceites, `google.com` só sob `/maps`, protocolos não-https rejeitados (incluindo `javascript:`), anfitriões desconhecidos rejeitados, URLs malformados rejeitados.

**E2E** (`tests/e2e/onboarding-business-step.spec.ts`, 4 testes, `chromium` + `webkit-mobile`):

1. **0 violações Axe** no formulário do passo 1.
2. **Normalização real:** preenche `"910 000 000"`, submete, e confirma via `service_role` que `business_settings.phone_e164` ficou `"+351910000000"` — não só que o formulário aceitou, mas que o valor persistido está correto.
3. **Maps URL insegura rejeitada:** `https://evil.example.com/track?redirect=/dashboard` → erro visível, permanece no passo 1.
4. **Maps URL segura aceite:** link real do Google Maps → avança para o passo 2.

**Bug de teste corrigido (não do produto):** o mesmo padrão de ambiguidade já visto em `NEX-020`/`NEX-021` — `getByLabel('Morada')` colidia com o `aria-label="Negócio e morada"` do próprio formulário (substring, case-insensitive). Corrigido com `{ exact: true }` no helper partilhado `tests/e2e/support/onboarding.ts`.

**Testes de `NEX-030` atualizados:** como o passo 1 passou a exigir dados reais, os testes do motor genérico (`onboarding-wizard.spec.ts`) que só clicavam "Seguinte" sem preencher nada deixaram de funcionar — atualizados para preencher o passo via `completeBusinessStep()`.

## Resultado

- `npm run verify`: aprovado.
- 39/40 testes E2E aprovados (1 skip esperado por design). 19 testes unitários.
- Próxima tarefa desbloqueada: `NEX-032`.
