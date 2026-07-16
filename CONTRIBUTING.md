# Contribuir

1. Leia `CLAUDE.md`.
2. Escolha uma tarefa desbloqueada.
3. Crie branch `task/NEX-###-descricao`.
4. Implemente com testes.
5. Execute `npm run verify`.
6. Abra PR com o template completo.

Mudanças em auth, RLS, reservas, financeiro, migrações ou workflows exigem revisão reforçada.

## Qualidade de código

- `npm run format` — verifica formatação (Prettier).
- `npm run lint` — ESLint com `--max-warnings=0` (zero tolerância a warnings).
- `npm run typecheck` — TypeScript em modo estrito.
- `npm run verify` — agrega format, lint, typecheck, testes e build; é o gate mínimo antes de qualquer commit/PR.

Estes mesmos checks correm no CI (`.github/workflows/ci.yml`) em cada PR e push para `main`, e bloqueiam o merge.

### Hook local (opcional)

Para correr format/lint/typecheck automaticamente antes de cada commit:

```bash
git config core.hooksPath .githooks
```

O hook (`.githooks/pre-commit`) é um script simples sem dependências adicionais. É opcional — o CI é a garantia definitiva — mas ajuda a detetar erros mais cedo.
