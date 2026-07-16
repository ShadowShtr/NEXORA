# Evidência — NEX-002 Configurar proteção de qualidade

**Data:** 16 de julho de 2026
**Estado:** concluído

## O que já existia

- `npm run format` (Prettier `--check`), `npm run lint` (ESLint `--max-warnings=0`) e `npm run typecheck` (`tsc --noEmit` em modo estrito) já estavam configurados e agregados em `npm run verify`.
- `.github/workflows/ci.yml` já corre estes três checks (mais testes e build) em cada PR e push para `main`.

## O que foi adicionado

- `.githooks/pre-commit`: hook local opcional, sem dependências novas, que corre format/lint/typecheck antes do commit. Ativação documentada em `CONTRIBUTING.md`:
  ```bash
  git config core.hooksPath .githooks
  ```
- Secção "Qualidade de código" em `CONTRIBUTING.md` explicando os comandos e o hook opcional.

## Teste do gate (erro controlado)

1. Ativado `core.hooksPath=.githooks`.
2. Criado ficheiro `src/lib/__quality_gate_test.ts` com violação de formatação/variável não utilizada.
3. Corrido `.githooks/pre-commit` → **falhou** (exit code 1) na verificação do Prettier, como esperado.
4. Removido o ficheiro de teste.
5. Corrido `.githooks/pre-commit` novamente → **passou** (format, lint e typecheck aprovados).

## Resultado

- `npm run verify`: aprovado.
- Gate local opcional funcional e documentado; gate de CI já era obrigatório via GitHub Actions.
- Nenhuma dependência nova introduzida (sem husky/lint-staged), conforme regra de simplicidade operacional do `CLAUDE.md`.

## Observações

- A proteção de branch no GitHub (exigir que o CI passe antes do merge) é escopo de `NEX-003`.
- Próxima tarefa desbloqueada: `NEX-003`.
