# NEXORA

NEXORA é uma plataforma SaaS de marcações e gestão para profissionais independentes, equipas e salões. A primeira vertical implementada é uma profissional independente de manicure/pedicure, mantendo a base multi-tenant preparada para evolução.

## Estado do repositório

Este repositório é uma **base de execução orientada por tarefas para Claude Code**. Ele contém:

- especificação funcional completa;
- fluxos de UX da cliente e da dona;
- arquitetura Next.js + Vercel + Supabase;
- modelo de dados multi-tenant e migração inicial com RLS;
- threat model, privacidade e operação;
- backlog executável com critérios de aceite;
- workflows de CI, CodeQL e dependency review;
- esqueleto inicial TypeScript/Next.js/PWA.

## Stack alvo

- Node.js 24 LTS
- npm com lockfile
- Next.js 16 App Router
- React 19
- TypeScript estrito
- Supabase Auth, PostgreSQL, Storage e Row-Level Security
- Vercel
- Vitest e Playwright
- GitHub Actions

## Ordem obrigatória de leitura para agentes

1. `CLAUDE.md`
2. `docs/reference/PROMPT_MESTRE_ARQUITETO_SAAS_CYBERSEGURANCA_PRIVACIDADE.md`
3. `docs/01_PRODUCT_REQUIREMENTS.md`
4. `docs/02_UX_FLOWS.md`
5. `docs/03_ARCHITECTURE.md`
6. `docs/04_DATA_MODEL.md`
7. `docs/05_SECURITY_PRIVACY.md`
8. `docs/ENVIRONMENTS_AND_SECRETS.md`
9. `TASKS.md`
10. O ficheiro do épico correspondente em `tasks/epics/`

## Arranque local

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Para executar a stack Supabase local, instale a Supabase CLI e siga `docs/08_OPERATIONS.md`.

## Verificação

```bash
npm run verify
```

O comando agrega lint, formatação, tipos, testes unitários e build.

## Publicação no GitHub

O ambiente atual não permitiu criar o repositório remoto automaticamente. O repositório local já está inicializado e pode ser publicado com:

```bash
bash scripts/publish-to-github.sh
```

O script cria o repositório privado `ltd-tech/nexora` usando GitHub CLI, configura o remote e envia a branch `main`.

## Regra de execução

Nenhuma funcionalidade é considerada concluída sem critérios de aceite, testes, atualização documental e verificação de segurança aplicável.
