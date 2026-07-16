# 08 — Produção e operação

> Matriz detalhada de ambientes, segredos, owners e rotação: `docs/ENVIRONMENTS_AND_SECRETS.md`.

## Ambientes

- Local: Supabase local e dados sintéticos.
- Preview: Vercel por PR, Supabase de desenvolvimento/preview quando viável.
- Produção: projeto Vercel e Supabase separados, credenciais próprias.

Nunca reutilizar service role de produção em preview.

## Deploy

1. PR aprovado.
2. CI verde.
3. Preview validado.
4. Migration revista.
5. Merge em `main`.
6. Deploy Vercel.
7. Smoke test automatizado.
8. Monitorização inicial.

## Migrações

- forward-only por padrão;
- transacionais quando suportado;
- alterações destrutivas em duas fases;
- backup/checkpoint antes de mudança de alto risco;
- nunca editar migration já aplicada.

## Observabilidade

Métricas:

- booking success/failure;
- slot conflict rate;
- p50/p95/p99;
- login failures;
- reminders pending overdue;
- payments pending;
- export failures;
- RLS denials/anomalias sem PII.

Alertas iniciais:

- aumento de 5xx;
- falha contínua de booking;
- migrations/deploy falho;
- e-mail provider degradado;
- erros de autenticação acima do baseline.

## Backups

- usar backups geridos do Supabase conforme plano;
- documentar frequência e retenção real;
- testar restore trimestralmente no MVP;
- RPO alvo inicial 24 h, RTO 4 h;
- aumentar proteção conforme clientes/receita.

## Incidentes

Severidades:

- SEV1: indisponibilidade ampla, acesso indevido confirmado, perda de dados.
- SEV2: booking/financeiro degradado sem workaround adequado.
- SEV3: falha limitada com workaround.
- SEV4: bug menor.

Cada incidente deve ter timeline, impacto, contenção, recuperação, comunicação e postmortem.

## Custos

Monitorizar:

- Vercel functions/bandwidth;
- Supabase DB/storage/egress;
- e-mail;
- observabilidade;
- geração de relatórios.

Definir alertas de budget antes do lançamento comercial.

## Runbooks mínimos

- booking indisponível;
- conflito elevado;
- auth indisponível;
- service role comprometida;
- restauração de backup;
- falha de e-mail;
- fotografia exposta;
- tenant access incident.
