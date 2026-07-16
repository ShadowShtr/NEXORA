# Evidência — NEX-004 Documentar ambientes e segredos

**Data:** 16 de julho de 2026
**Estado:** concluído

## O que foi criado

- `docs/ENVIRONMENTS_AND_SECRETS.md`: matriz local/preview/produção, owner de segredos (conta `ShadowShtr`, projeto solo), tabela completa de variáveis (âmbito público/server-only, propósito, onde vive, cadência de rotação, estado atual vs. planeado por tarefa futura).
- Referenciado em `README.md` (ordem de leitura) e `docs/08_OPERATIONS.md`.

## Verificação de segredos

- `git log --all --diff-filter=A -- .env .env.local` → sem resultados.
- `git ls-files | grep '^\.env'` → apenas `.env.example` (placeholders vazios).
- `git log -p --all | grep` por padrões de chave preenchida → sem resultados.
- Gitleaks (CI, ativo desde `NEX-003`) não acusou segredos.

## Resultado

- `npm run verify`: aprovado.
- Nenhum segredo commitado; matriz de ambientes e rotação documentada e rastreável a IDs de tarefas futuras.
- Próxima tarefa desbloqueada: `NEX-005`.
