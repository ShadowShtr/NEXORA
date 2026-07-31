# NEX-173 — Backups e restore test

## Objetivo

Ter uma política real de backup e um restore comprovado para a base de dados
e para o Storage da NEXORA, sem comprar nenhum serviço adicional nesta fase
(ver `NEXORA_PLANO_MESTRE_CONSTRUCAO_UI_SEM_CUSTOS.md`, Fase zero).

## Contexto real confirmado nesta tarefa

O projeto Supabase de **produção** está no plano **Free** (confirmado pela
dona). O plano Free do Supabase **não inclui backups automáticos** do lado do
fornecedor — essa é uma funcionalidade exclusiva do plano Pro em diante
(backups diários com retenção de 7 dias; PITR é um add-on pago à parte). Isto
significa que, sem ação explícita deste projeto, **não existe hoje nenhuma
salvaguarda de recuperação de desastre para os dados de produção da NEXORA**.
Esta tarefa fecha essa lacuna com um mecanismo lógico de backup/restore
mantido pelo próprio repositório.

## Porque não corre localmente

Duas limitações reais desta máquina de desenvolvimento, já documentadas em
`ADR-007`:

- **Sem Postgres client tools** (`pg_dump`/`psql`) instalados nativamente.
- **Docker Desktop não funciona** (`supabase start` falha a conectar ao daemon
  — confirmado noutras tarefas e novamente aqui: `supabase db dump --db-url
...` falha com `failed to connect to the docker API at
npipe:////./pipe/dockerDesktopLinuxEngine`, porque o CLI do Supabase corre o
  `pg_dump` real dentro de um contentor Docker para garantir compatibilidade
  de versão).

O runner `ubuntu-latest` do GitHub Actions, pelo contrário, **já correu
Docker com sucesso** nesta stack (`supabase start` no job `integration` e no
`e2e-critical` do `ci.yml`, comprovado em produção real — ver
`docs/evidence/NEX-178_PUBLIC_BOOKING_CLIENT_CONCURRENCY.md`). Por isso o
mecanismo de backup/restore desta tarefa corre em CI, não localmente.

## Mecanismo implementado

`.github/workflows/backup-restore-test.yml`:

1. **Trigger**: diário (`cron: '0 4 * * *'`) + manual (`workflow_dispatch`).
   Só corre de facto se a variável de repositório `BACKUP_ENABLED` estiver
   `'true'` (agendado) ou se for disparado manualmente — permite mesclar o
   workflow antes de o secret/variável existirem, sem quebrar o repositório
   nem gastar minutos de CI à toa.
2. **Dump**: `supabase db dump --db-url $BACKUP_SOURCE_DATABASE_URL` — schema
   e dados (com `--use-copy`, mais compacto e mais rápido a restaurar que
   `INSERT` linha a linha) — para o projeto apontado pelo secret
   `BACKUP_SOURCE_DATABASE_URL` (connection string direta do Postgres,
   obtida em Project Settings → Database → Connection string, nunca a
   `NEXT_PUBLIC_SUPABASE_URL`/chaves da API).
3. **Restore**: para um serviço `postgres:15` efémero do próprio job (nasce e
   morre com o job, sem custo, sem tocar em nenhum projeto Supabase).
4. **Verificação de integridade**: compara `count(*)` por tabela
   tenant-scoped (`tenants`, `profiles`, `appointments`, `clients`,
   `services`, `service_categories`, `audit_logs`) entre a origem e o
   restaurado — falha o job se alguma contagem divergir.
5. **Evidência**: upload do dump como artifact do workflow, retenção de 7
   dias (`retention-days: 7`) — não é commitado ao repositório (contém dados
   reais de clientes).

## RPO / RTO realistas

- **RPO alvo: 24 horas** — cadência diária do workflow. Ajustável só mudando
  o `cron`; para um volume de dados maior no futuro, considerar recorrer ao
  plano Pro do Supabase (backups diários geridos + PITR) em vez de manter
  isto como único mecanismo — ver `NEXORA_PLANO_MESTRE...md`, nota sobre
  custo crescer com utilização não ser "módulo pago obrigatório".
- **RTO estimado: sob 30 minutos** — o restore completo (schema + dados) para
  o Postgres efémero do runner demora tipicamente 1–3 minutos para o volume
  de dados atual (fase beta/pré-lançamento); um restore manual real para um
  projeto Supabase novo (criar projeto, aplicar `schema.sql`, aplicar
  `data.sql`, apontar a app para o novo projeto) é o mesmo procedimento mais
  a criação do projeto e a troca de variáveis de ambiente no Vercel — por
  isso a estimativa de 30 minutos inclui essa margem, não só o `psql`.

## Estado real desta tarefa — o que falta

O workflow está escrito, com sintaxe validada (`js-yaml`) e nomes de tabela
confirmados contra `supabase/migrations/0001_initial.sql`. **Não foi
executado com dados reais nesta sessão** — falta um passo que só a dona pode
fazer, porque exige a password da base de dados de produção, que nunca deve
ser colada neste chat nem em nenhum ficheiro do repositório:

1. Obter a connection string direta do Postgres em **Project Settings →
   Database → Connection string** (modo "URI", não o pooler de sessão) do
   projeto de produção — ou, para um primeiro ensaio mais seguro, do projeto
   de dev/preview (`znakuwpmapkhzuntzorj`), que já é descartável por
   definição (`ADR-007`).
2. Adicionar como secret do repositório: `gh secret set
BACKUP_SOURCE_DATABASE_URL` (ou pelo GitHub, Settings → Secrets and
   variables → Actions → New repository secret).
3. Criar a variável de repositório `BACKUP_ENABLED=true` (Settings → Secrets
   and variables → Actions → Variables) para ativar o agendamento diário, ou
   disparar manualmente uma vez via `gh workflow run
"Backup e restore test (NEX-173)"` para validar antes de agendar.
4. Confirmar que o job corre verde e anexar o link do run como evidência
   complementar a este documento.

**Até esse passo ser feito pela dona, a Definition of Done desta tarefa fica
parcial** (mecanismo pronto e revisto, mas sem uma execução real comprovada)
— mesmo padrão de honestidade usado em
`docs/evidence/NEX-172_DEPLOY_PREVIEW_PROD_SEPARADOS.md`.

## Segurança e privacidade

- O secret nunca é impresso em logs (o GitHub Actions mascara automaticamente
  valores registados como `secrets.*`).
- O dump nunca é commitado ao repositório — só existe como artifact
  temporário (7 dias) do workflow, visível apenas a quem tem acesso ao
  repositório (hoje, só a dona).
- O Postgres de restore é efémero (nasce e morre com o job) — nunca persiste
  dados de produção fora do runner.
- Risco residual aceite: os artifacts do GitHub Actions ficam retidos 7 dias
  com dados reais de clientes — aceitável enquanto o repositório for privado
  e de acesso único, deve ser revisto se/quando houver mais colaboradores
  com acesso ao repositório (ver `EPIC-19`).

## Definition of Done

- [x] Mecanismo de backup/restore implementado (workflow CI) e documentado
- [ ] Testes concluídos — sintaxe validada; execução real pendente da dona (secret de produção)
- [x] Documentação atualizada (`docs/ENVIRONMENTS_AND_SECRETS.md`, este ficheiro)
- [ ] Critérios de aceite validados — "restore comprovado" só fecha depois de um run real verde
- [ ] Tarefa marcada como `[x]` no `TASKS.md` — fica `[~]` até à execução real
