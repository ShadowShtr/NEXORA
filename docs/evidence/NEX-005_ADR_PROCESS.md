# Evidência — NEX-005 Estabelecer ADR e processo de mudanças

**Data:** 16 de julho de 2026
**Estado:** concluído

## O que foi criado

- `docs/adr/TEMPLATE.md`: modelo reutilizável (Estado, Contexto, Opções, Decisão, Consequências, Segurança e privacidade).
- `docs/adr/README.md`: processo — quando um ADR é obrigatório, como abrir, como revisar (novo ADR, nunca reescrever um aceite), índice de todos os ADRs com estado.
- `docs/adr/ADR-006-github-plan-constraints.md`: primeiro ADR aberto sob o novo processo, documentando a decisão real tomada em `NEX-003` (repositório privado sem branch protection nativa, por limitação de plano GitHub) — prova que o processo funciona com uma decisão crítica real, não só hipotética.
- `CONTRIBUTING.md` atualizado: quando abrir ADR, e correção da frase sobre branch protection para refletir `ADR-006` com precisão (checks de CI não bloqueiam merge tecnicamente neste plano — é convenção).

## Critério de aceite: decisões críticas rastreáveis

- Cada ADR aceite fica indexado em `docs/adr/README.md` com link direto.
- Cada tarefa que tome uma decisão arquitetural/crítica deve referenciar o ADR correspondente na sua evidência (`docs/evidence/NEX-###_*.md`) — já demonstrado em `NEX-003` → `ADR-006`.
- Revogações não apagam histórico: um ADR só é alterado para `Substituído por ADR-NNN`, nunca reescrito com a nova decisão.

## Resultado

- `npm run verify`: aprovado.
- Revisão documental: 6 ADRs indexados e consistentes (001–005 pré-existentes, 006 novo), template e processo publicados.
- EPIC-00 (Governança e fundação do repositório) concluído: NEX-001 a NEX-005 todos `[x]`.
- Próxima tarefa desbloqueada: `NEX-010` (EPIC-01 — Supabase, dados e isolamento).
