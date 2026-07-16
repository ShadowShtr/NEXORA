# Evidência — NEX-003 Configurar repositório GitHub

**Data:** 16 de julho de 2026
**Estado:** concluído (com um risco residual documentado)

## Decisões confirmadas com o owner

- Repositório passa a **privado** (era público desde a criação vazia).
- Fluxo de trabalho a partir desta tarefa: **branch por tarefa + PR + merge via `gh` CLI**, sem push direto em `main`, conforme `CLAUDE.md`.

## Ações executadas

1. `gh repo edit ShadowShtr/NEXORA --visibility private --accept-visibility-change-consequences` → confirmado `isPrivate: true`.
2. `gh api -X PUT repos/ShadowShtr/NEXORA/vulnerability-alerts` → Dependabot alerts ativos.
3. `gh api -X PUT repos/ShadowShtr/NEXORA/automated-security-fixes` → Dependabot security updates ativos.
4. Adicionado `.github/workflows/secret-scan.yml` (Gitleaks) — ver risco residual abaixo.
5. Branch protection em `main` (aplicada após esta PR abrir e os checks correrem pela primeira vez):
   - PR obrigatório antes de merge (`required_pull_request_reviews`, `required_approving_review_count: 0` — força PR mas não exige um segundo revisor humano, inexistente neste projeto solo).
   - Status checks obrigatórios: `verify` (CI), `analyze` (CodeQL), `gitleaks` (Secret Scan), `review` (Dependency Review, só em PR).
   - `enforce_admins: true` — a regra aplica-se também ao owner; merges passam a ser feitos via `gh pr merge`, nunca `git push` direto.
   - Force-push e deleção de `main` bloqueados.

## Risco residual: secret scanning nativo do GitHub

A API do GitHub devolveu `422 Secret scanning is not available for this repository` ao tentar ativar `secret_scanning` + `secret_scanning_push_protection` nativos. **Motivo:** secret scanning nativo em repositórios **privados** requer GitHub Advanced Security, disponível apenas para organizações em planos Enterprise/Team pagos — não existe para contas pessoais/privadas neste plano.

**Mitigação aplicada:** workflow `secret-scan.yml` com [Gitleaks](https://github.com/gitleaks/gitleaks-action) (open-source, gratuito, sem custo adicional, sem novo serviço externo em execução — corre só em CI). Cobre o mesmo objetivo (impedir merge de segredos commitados), com uma diferença: não bloqueia o `git push` em tempo real (push protection), apenas falha o check da PR antes do merge — como `main` passa a exigir PR + checks obrigatórios, o efeito prático é equivalente.

**Decisão de produto pendente (bloqueio registado, não inventado):** se o owner quiser secret scanning nativo com push protection em tempo real, é necessário decidir se a organização/conta migra para um plano GitHub com Advanced Security. Não avancei com essa mudança de plano/custo sem aprovação explícita.

## Risco residual: Dependency Review

A action `actions/dependency-review-action` falhou no primeiro PR com o mesmo motivo: _"Dependency review is not supported on this repository. Please ensure that Dependency graph is enabled along with GitHub Advanced Security"_. Mesma causa raiz do secret scanning (GHAS indisponível para repo privado de conta pessoal).

**Mitigação aplicada:** `dependency-review.yml` alterado de `on: pull_request` para `on: workflow_dispatch` (manual), com comentário no ficheiro a explicar o motivo e como reativar. Evita um check permanentemente vermelho em todas as PRs sem valor real. Dependabot (alertas + security updates), já ativo, cobre parcialmente o mesmo objetivo (deteção de dependências vulneráveis), embora sem o gate automático em PR.

**Checks obrigatórios finais na branch protection de `main`:** `verify` (CI), `analyze` (CodeQL), `gitleaks` (Secret Scan). `review` (Dependency Review) não é obrigatório — corre apenas manualmente.

## Correções de permissões (primeira execução dos workflows na PR #1)

- `gitleaks` falhou com `403 Resource not accessible by integration` ao listar commits da PR — faltava `pull-requests: read`. Corrigido em `secret-scan.yml`.
- `analyze` (CodeQL) falhou com `Resource not accessible by integration` / `CodeQL job status was configuration error` ao tentar obter informação do workflow run — faltava `actions: read`. Corrigido em `codeql.yml`.
- Ambos não relacionados com GHAS; são permissões padrão de `GITHUB_TOKEN` por job.

## Resultado

- `npm run verify`: aprovado.
- Repositório privado, protegido, com Dependabot, CodeQL e Gitleaks ativos como gates de PR obrigatórios.
- Dependency Review disponível manualmente (`workflow_dispatch`), bloqueado como gate automático por limitação de plano GitHub.
- Próxima tarefa desbloqueada: `NEX-004`.
