# NEXORA

NEXORA é uma plataforma SaaS de marcações e gestão para profissionais independentes, equipas e salões. A primeira vertical implementada é uma profissional independente de manicure/pedicure, mantendo a base multi-tenant preparada para evolução.

## Estado do repositório

NEXORA já é uma aplicação em produção, não um esqueleto inicial. EPIC-00 a
EPIC-16 (fundação, dados/RLS, autenticação, onboarding, catálogo, marcação
pública, disponibilidade, confirmação, agenda, clientes, lembretes,
conclusão/pagamentos, recorrência, financeiro, definições, PWA/design,
privacidade/segurança) estão completos e em produção. EPIC-17
(observabilidade/CI/lançamento) está quase completo — ver `TASKS.md` para o
estado exato de cada tarefa.

Em produção, o repositório já entrega:

- autenticação e onboarding guiado da dona;
- catálogo de categorias, serviços e pacotes;
- marcação pública paginada por várias páginas (`/b/{slug}/servicos` →
  `/horario` → `/dados` → `/resumo`), com disponibilidade calculada,
  reserva transacional/idempotente e proteção contra dupla marcação
  (Route Handler + Server Actions, constraint de exclusão no Postgres);
- agenda diária/semanal/mensal, criação manual de marcação e recorrência;
- clientes, histórico e fotografias privadas;
- lembretes manuais via deep link do WhatsApp;
- conclusão de atendimento, extras/descontos e pagamentos pendentes;
- financeiro interno com exportação CSV/Excel/PDF;
- PWA instalável, RLS multi-tenant e auditoria append-only;
- CI com testes unitários, integração (RLS/isolamento) e E2E crítico
  (`e2e-critical`, Playwright contra Supabase local no runner) — branch
  `main` protegida, exige todos os checks antes de merge.

Um plano mestre de expansão (equipas/prestadores, área do cliente, packs e
vouchers, caixa interna, stock, comissões, CRM, fichas/consentimentos,
multi-localização, relatórios avançados, notificações, ajuda, planos/limites,
landing) está a ser executado a partir de `EPIC-18` — ver `TASKS.md` e
`tasks/epics/EPIC-18.md` em diante.

**Distinção importante de vocabulário**: um **pacote de serviços**
(`packages`, `EPIC-04`) agrupa vários serviços na mesma marcação; um **pack
de sessões** (`EPIC-21`, ainda por implementar) é um direito adquirido a
várias utilizações ao longo do tempo. Não são a mesma entidade.

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

## Repositório e deploy

Repositório privado: `github.com/ShadowShtr/NEXORA`. A branch `main` tem
proteção ativa (ruleset do GitHub) — exige Pull Request e os checks
`verify`, `integration`, `E2E crítico`, `gitleaks` e `analyze` verdes antes
de qualquer merge; não é possível fazer push direto a `main`.

Deploy de produção é automático (Vercel ↔ GitHub): cada push a `main`
dispara um novo deployment de produção. Ver `docs/08_OPERATIONS.md` e
`docs/ENVIRONMENTS_AND_SECRETS.md` para a matriz de ambientes/segredos, e
`docs/RUNBOOKS.md` para os runbooks de incidente.

## Regra de execução

Nenhuma funcionalidade é considerada concluída sem critérios de aceite, testes, atualização documental e verificação de segurança aplicável.
