# Processo de ADR (Architecture Decision Record)

Registo de `NEX-005`. Este ficheiro é o processo; `TEMPLATE.md` é o modelo a copiar; cada decisão vive no seu próprio `ADR-NNN-slug.md`.

## Quando abrir um ADR

Abrir um ADR **antes** de implementar, sempre que a mudança:

- alterar um requisito já aprovado em `docs/01_PRODUCT_REQUIREMENTS.md` (regra fixa do `CLAUDE.md`: "Não alterar requisitos aprovados sem ADR");
- escolher ou trocar uma peça de arquitetura, stack, modelo de dados ou estratégia de concorrência;
- introduzir, remover ou substituir um serviço externo (ex.: provedor de e-mail, rate limit, observabilidade);
- mudar uma garantia de segurança, privacidade ou multi-tenancy;
- for uma decisão difícil de reverter ou cara de refazer mais tarde.

Não é necessário ADR para detalhes de implementação reversíveis dentro do escopo já aprovado de uma tarefa (nome de variável, estrutura interna de uma função, etc.) — esses ficam no PR e no commit da tarefa.

## Como abrir

1. Copiar `docs/adr/TEMPLATE.md` para `docs/adr/ADR-NNN-slug-curto.md`, `NNN` sequencial com 3 dígitos, sem reordenar ADRs existentes.
2. Preencher todas as secções, incluindo "Segurança e privacidade" mesmo quando não houver impacto.
3. Estado inicial normalmente `Proposto`; passa a `Aceite` quando a decisão for tomada (nesta fase solo, aceite pelo owner `ShadowShtr`).
4. Referenciar o ADR no PR e na evidência da tarefa (`docs/evidence/NEX-###_*.md`) que a implementa.
5. Se uma decisão for revista, **não editar o ADR antigo com a nova conclusão** — criar um novo ADR e marcar o antigo como `Substituído por ADR-NNN`. Preserva rastreabilidade histórica.

## Índice de ADRs aceites

| ADR                                                     | Título                                                                    | Estado |
| ------------------------------------------------------- | ------------------------------------------------------------------------- | ------ |
| [ADR-001](ADR-001-monolito-modular.md)                  | Monólito modular Next.js                                                  | Aceite |
| [ADR-002](ADR-002-multitenancy.md)                      | Multitenancy                                                              | Aceite |
| [ADR-003](ADR-003-whatsapp-manual.md)                   | WhatsApp manual (sem API paga)                                            | Aceite |
| [ADR-004](ADR-004-money-time.md)                        | Dinheiro e tempo (cêntimos, UTC)                                          | Aceite |
| [ADR-005](ADR-005-booking-concurrency.md)               | Concorrência de marcação                                                  | Aceite |
| [ADR-006](ADR-006-github-plan-constraints.md)           | Limitações do plano GitHub (branch protection e GHAS)                     | Aceite |
| [ADR-007](ADR-007-supabase-dev-cloud-fallback.md)       | Projeto Supabase cloud como substituto do Docker local em dev             | Aceite |
| [ADR-008](ADR-008-function-privilege-defaults.md)       | Revogação explícita de EXECUTE em funções `security definer`              | Aceite |
| [ADR-009](ADR-009-supabase-email-link-implicit-flow.md) | Links de e-mail do Supabase Auth usam fluxo implícito, não PKCE           | Aceite |
| [ADR-010](ADR-010-write-confirmation-standard.md)       | Padrão de confirmação de escrita (`hasAffectedRows`)                      | Aceite |
| [ADR-011](ADR-011-tenant-members-extends-profiles.md)   | Equipa/prestadores estende `profiles`, não cria `tenant_members` paralela | Aceite |
| [ADR-012](ADR-012-multi-provider-overlap-exclusion.md)  | Exclusão de sobreposição deixa de ser só tenant-wide                      | Aceite |

Atualizar esta tabela sempre que um ADR novo for aceite.
