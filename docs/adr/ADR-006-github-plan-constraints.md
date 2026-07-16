# ADR-006 — Limitações do plano GitHub (branch protection e GHAS)

## Estado

Aceite

## Contexto

`NEX-003` exigia repositório privado com `main` protegida (PR obrigatório, sem push direto), secret scanning nativo, dependency review nativo e code scanning (CodeQL) com alertas na aba Security. Ao configurar, três chamadas à API do GitHub falharam por limitação de plano, não de execução:

- Branch protection em repositório privado de conta pessoal → `403 Upgrade to GitHub Pro or make this repository public`.
- Secret scanning nativo (+ push protection) em repositório privado → `422 Secret scanning is not available for this repository` (requer GitHub Advanced Security, só disponível para organizações em planos Enterprise/Team).
- Dependency review e code scanning nativo (upload de alertas CodeQL) → mesma causa raiz de GHAS.

Nenhuma destas limitações é corrigível por configuração; exigem decisão de custo (upgrade de plano) fora do escopo automatizável desta sessão.

## Opções

1. Tornar o repositório público para desbloquear branch protection e secret scanning nativos gratuitamente — mas expõe lógica de negócio e arquitetura antes do lançamento.
2. Owner subscreve GitHub Pro/Advanced Security agora, antes de haver produto ou receita.
3. Manter repositório privado, sem enforcement técnico de branch protection, e substituir os gates nativos indisponíveis por alternativas open-source em CI (Gitleaks para secrets; CodeQL com upload em artifact em vez de alertas nativos); seguir o fluxo branch→PR→merge por convenção documentada, não por bloqueio técnico.

## Decisão

Opção 3, confirmada com o owner (`ShadowShtr`) durante a execução de `NEX-003`: repositório privado, sem branch protection nativa, com Gitleaks e CodeQL (artifact) como mitigação, e disciplina de processo documentada em `CONTRIBUTING.md`/`CLAUDE.md` em vez de bloqueio automático do GitHub.

## Consequências positivas

- Sem custo adicional nesta fase pré-receita.
- Código e arquitetura de negócio permanecem privados.
- Cobertura de segurança equivalente na prática (Gitleaks bloqueia merge de segredos via CI; CodeQL continua a analisar todo push/PR).

## Consequências negativas

- Nada impede tecnicamente um `git push` direto a `main` — depende de disciplina, não de controlo técnico.
- Sem push protection em tempo real (Gitleaks só falha o check da PR, não bloqueia o `git push` em si).
- Sem persistência nativa de alertas de code scanning na aba Security do GitHub (resultados só como artifact de CI, com retenção de 30 dias).
- Se o owner adicionar colaboradores no futuro, a ausência de enforcement técnico passa a ser um risco maior do que é hoje (projeto solo).

## Segurança e privacidade

Risco residual aceite explicitamente pelo owner, documentado também em `docs/evidence/NEX-003_GITHUB_REPO_SETUP.md`. Reavaliar esta decisão (novo ADR, não edição deste) se: (a) a NEXORA ganhar um segundo colaborador com acesso de escrita, (b) o owner decidir subscrever GitHub Pro/Advanced Security, ou (c) antes do lançamento comercial (`NEX-177`), como parte do checklist de beta privado.
