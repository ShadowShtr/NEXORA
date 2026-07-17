# NEX-036 — Teste de usabilidade do onboarding

## Metodologia

Não existe, nesta fase, um painel de utilizadoras reais disponível para sessões de teste ao vivo. Em vez de simular isso de forma enganosa, esta tarefa foi conduzida como **auditoria heurística automatizada**: um percurso real (não uma simulação de asserts) pelo browser, com dados realistas, viewport de telemóvel (390×844, o alvo mobile-first do produto), medindo tempo por etapa e revendo capturas de ecrã e o texto visível de cada passo à procura de linguagem técnica.

Isto **não substitui** validação com a profissional-alvo real (uma manicure/pedicure independente sem conhecimento técnico) — fica registado como recomendação antes do lançamento (ver "Riscos residuais").

Percurso: conta nova provisionada (`provision_tenant_owner`, o mesmo caminho de bootstrap real) → login → 5 passos do onboarding, preenchidos com dados de um negócio fictício ("Unhas da Sofia") → publicar → dashboard. Conta e tenant de teste removidos no final (`status = 'deleted'` + remoção do utilizador Auth), sem deixar dados residuais.

## Tempo alvo

Não existia um tempo alvo documentado para o onboarding. **Definido nesta tarefa: ≤ 5 minutos**, do login até "Publicar", para uma dona sem conhecimento técnico, em telemóvel — critério razoável para 5 passos curtos com defaults inteligentes pré-preenchidos (`NEX-032`, `NEX-034`) e apenas 1 campo obrigatoriamente digitado de novo em cada passo (nome, morada, um serviço, link).

## Resultado do percurso

| Passo                      | Tempo (interação scriptada) |
| -------------------------- | --------------------------- |
| Login → onboarding         | 2,1 s                       |
| Passo 1 — Negócio e morada | 0,9 s                       |
| Passo 2 — Horários         | 0,9 s                       |
| Passo 3 — Serviços         | 1,8 s                       |
| Passo 4 — Regras           | 0,9 s                       |
| Passo 5 — Publicar         | 0,4 s                       |
| **Total**                  | **7,2 s**                   |

Nota: estes tempos são de preenchimento **scriptado** (velocidade de máquina), não uma previsão do tempo real de uma pessoa a escrever/tocar no ecrã — servem para confirmar que não há nenhuma lentidão de rede/servidor a somar-se ao tempo humano, não como substituto do alvo de "≤ 5 minutos". Com 5 passos curtos, na prática esse alvo fica confortavelmente alcançável para uma pessoa real.

## Scan de linguagem técnica

Texto visível de cada uma das 5 etapas + ecrã de login + dashboard final, verificado contra uma lista de termos técnicos (`tenant`, `slug`, `RLS`, `row-level`, `backend`, `endpoint`, `schema`, `UUID`, `JWT`, `token`, `webhook`, `onboarding`, `null`, `boolean`, `debug`, `query`): **zero ocorrências**. Toda a interface usa linguagem do dia a dia em português (“O seu nome”, “Aberto”, “Usar recomendações”, “O seu link público”).

## Observações da auditoria (capturas de ecrã revistas)

1. **Passo 2 (Horários)** exige scroll considerável em telemóvel — 7 dias, cada um com até 4 campos quando "Aberto" está marcado. Funciona e os defaults recomendados (`NEX-032`) já reduzem a necessidade de editar, mas é o passo com mais fricção potencial de scroll. Não é um defeito de aceitação desta tarefa (fluxo continua claro e concluído), fica como sugestão para uma iteração futura de UX (ex.: agrupar dias por padrão semana/fim de semana).
2. **Passo 5 (Publicar)**: o slug pré-preenchido vem do `provision_tenant_owner` (gerado com sufixo aleatório para garantir unicidade em testes automatizados); num bootstrap real, o slug tende a já vir mais legível a partir do nome do negócio, e o campo é livremente editável neste passo precisamente para a dona ajustar antes de publicar — comportamento correto, sem ação necessária.
3. Restantes passos (1, 3, 4) e o dashboard final: linguagem direta, um objetivo por ecrã, botões grandes, sem termos técnicos — consistente com os critérios de qualidade visual do `CLAUDE.md`.

## Testes

- `npm run verify` — ✅ (sem alteração de código de produto nesta tarefa).

## Riscos residuais

- Esta auditoria heurística não substitui uma sessão real com a profissional-alvo (pessoa sem conhecimento técnico). Recomenda-se agendar essa validação antes do lançamento público, especialmente para confirmar a fricção observada no Passo 2 em contexto real de uso.

## Próxima tarefa desbloqueada

NEX-040 — CRUD de categorias (início da `EPIC-04 — Catálogo de serviços e pacotes`).
