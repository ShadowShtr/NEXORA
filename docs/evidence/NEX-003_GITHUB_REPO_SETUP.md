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
5. Tentativa de branch protection em `main` — **bloqueada pelo plano GitHub** (ver risco residual dedicado abaixo). Fluxo PR obrigatório mantido por convenção, não por enforcement técnico.

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

## Risco residual: CodeQL code scanning (upload de alertas)

Após corrigir as permissões, `analyze` voltou a falhar, agora com: _"Code scanning is not enabled for this repository. Please enable code scanning in the repository settings."_ — terceira ocorrência da mesma limitação: **code scanning (upload de resultados para a aba Security) também requer GitHub Advanced Security em repositórios privados de conta pessoal.**

**Mitigação aplicada:** `codeql-action/analyze` configurado com `upload: never` e `output: sarif-results`; o SARIF resultante é publicado como artifact da run (`actions/upload-artifact`, retenção 30 dias) em vez de tentar escrever na aba Security. A análise estática continua a correr em todo push/PR — só a persistência nativa de alertas fica indisponível.

**Resumo do padrão GHAS neste repositório:** secret scanning nativo, dependency review e code scanning nativo estão todos bloqueados pela mesma causa (GitHub Advanced Security não disponível para repositório privado de conta pessoal). Mitigado com Gitleaks (CI), Dependabot (alerts/security updates) e CodeQL com upload em artifact, respetivamente. Decisão de upgrade de plano permanece pendente e não foi tomada nem inventada.

## Risco residual: branch protection não aplicável (plano GitHub)

Ao tentar aplicar `PUT /repos/ShadowShtr/NEXORA/branches/main/protection`, a API devolveu `403 Upgrade to GitHub Pro or make this repository public to enable this feature`. **Motivo:** branch protection em repositórios privados de conta pessoal também requer GitHub Pro (plano pago), não apenas GHAS.

**Decisão confirmada com o owner:** manter o repositório privado, **sem** enforcement técnico de branch protection no GitHub. O fluxo branch por tarefa → PR → merge via `gh` CLI (`CLAUDE.md`, `CONTRIBUTING.md`) continua a ser seguido **por convenção/disciplina de processo**, não por bloqueio técnico do GitHub. Nada impede tecnicamente um push direto a `main`, mas essa ação não será tomada.

Se o owner decidir subscrever GitHub Pro no futuro, a proteção real pode ser aplicada com o mesmo payload documentado acima (`required_status_checks`: `verify`, `analyze`, `gitleaks`; `enforce_admins: true`; `required_approving_review_count: 0`).

## Resultado

- `npm run verify`: aprovado.
- Repositório privado; Dependabot, CodeQL (upload em artifact) e Gitleaks ativos como checks de CI em cada PR/push, mas **não tecnicamente obrigatórios** para merge (branch protection indisponível no plano atual).
- Dependency Review disponível manualmente (`workflow_dispatch`), limitação de plano GitHub.
- Fluxo branch+PR+merge mantido por convenção de processo a partir desta tarefa.
- Próxima tarefa desbloqueada: `NEX-004`.
