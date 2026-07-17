# ADR-007 — Projeto Supabase cloud como substituto do Docker local em desenvolvimento

## Estado

Aceite

## Contexto

`NEX-010` exigia inicializar Supabase local via CLI (`supabase start`, que depende de Docker). Este ambiente de execução não tem Docker nem WSL2 disponíveis — a instalação foi tentada (ver conversa da tarefa) mas o processo de instalação do WSL2 (`wsl --install`) falhou de forma inconsistente entre a sessão de execução de comandos e a janela PowerShell aberta manualmente pelo owner, ambas alegadamente no mesmo PC (`PC-CAIXA`). Não foi possível diagnosticar a causa raiz com confiança nem elevar privilégios a partir desta sessão para instalar WSL2/Docker.

Sem Postgres disponível de alguma forma, nenhuma tarefa de `EPIC-01` em diante pode ser implementada nem testada.

## Opções

1. Continuar a diagnosticar/instalar Docker + WSL2 localmente — tempo indeterminado, sem garantia de sucesso.
2. Owner subscreve/instala Docker Desktop fora desta sessão e retoma-se mais tarde — bloqueia todo o progresso até lá.
3. Usar um projeto Supabase cloud gratuito dedicado a desenvolvimento como substituto do Postgres local nesta sessão, aplicando migrações via `supabase db push --db-url`.

## Decisão

Opção 3, confirmada com o owner. Projeto Supabase cloud criado pelo owner (ref `znakuwpmapkhzuntzorj`, organização "vitorshadowmedina@gmail.com's Org", plano Free) passa a fazer o papel de ambiente de desenvolvimento interativo nesta fase. Credenciais guardadas apenas em `.env.local` (nunca commitado); ver `docs/ENVIRONMENTS_AND_SECRETS.md`.

`supabase/config.toml` foi criado (via `supabase init`) mesmo sem uso de `supabase start`, para que o fluxo local com Docker continue documentado e pronto a usar assim que o ambiente permitir (`major_version` ajustado para `14`, a versão real do Postgres do projeto).

## Consequências positivas

- Desbloqueia imediatamente `EPIC-01` em diante sem depender de resolver o problema de Docker/WSL.
- Testes de RLS/isolamento continuam a correr contra um Postgres real (não simulado), com o mesmo motor (`PostgREST` + `Postgres`) que produção.
- `supabase/config.toml` e `supabase/migrations/` continuam válidos para uso local com Docker assim que disponível — nenhuma mudança de rumo de arquitetura.

## Consequências negativas

- O "local" desta fase é, na prática, um recurso cloud partilhado (ainda que gratuito e isolado do projeto de produção) — não é isolado por developer nem descartável instantaneamente como um container Docker.
- `supabase db reset` (reset completo local) não foi exercitado — apenas idempotência de `db push`/seed foi validada (reaplicar migração e seed não duplica dados nem falha). Reset completo fica coberto de forma mais rigorosa em CI (`NEX-015`, que corre com Docker nativo em runners GitHub Actions).
- Se o owner ou outro colaborador instalar Docker no futuro, este projeto cloud de dev deve ser tratado como descartável/recriável — não guardar nele nenhum dado que não possa ser perdido.

## Segurança e privacidade

- Nenhum dado real de cliente entra neste projeto — apenas dados sintéticos (`supabase/seed.sql`) e tenants de teste criados/apagados durante verificação de RLS.
- Chaves guardadas apenas em `.env.local` (gitignored); nunca impressas em logs de commit ou documentação.
- Este projeto é explicitamente "dev", nunca "produção" — reforçar isto se o nome do projeto no dashboard Supabase (`NEXORA`, branch default rotulada "PRODUCTION" pela UI de branching do Supabase) causar confusão: é só a nomenclatura padrão do Supabase para o branch principal de qualquer projeto, não uma declaração de que este projeto serve produção.
