# 09 — Plano de lançamento

## Fase 0 — Fundação

Repositório, CI, ambientes, docs, schema e RLS.

## Fase 1 — Vertical de marcação

Onboarding, catálogo, disponibilidade, booking público e agenda da dona.

## Fase 2 — Operação diária

Clientes, lembretes WhatsApp, conclusão, pagamentos e pendências.

## Fase 3 — Gestão

Recorrência, bloqueios avançados, relatórios e exportações.

## Fase 4 — Hardening

PWA, acessibilidade, performance, privacy workflows, observabilidade, restore, pentest.

## Beta privado

Critérios:

- uma dona real consegue concluir onboarding sem ajuda técnica;
- cinco fluxos de marcação consecutivos sem erro;
- sem dupla reserva em teste concorrente;
- RLS validada;
- export financeiro reconciliado;
- backup/restore verificado;
- política de privacidade e contratos revistos externamente.

## Produção comercial

- Vercel/Supabase em planos compatíveis com uso comercial e necessidades de backup;
- domínio e e-mail configurados;
- monitorização e budget alerts;
- DPA/subprocessadores documentados;
- pentest proporcional;
- suporte e incident owner definidos.
