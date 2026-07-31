# NEX-174 — Runbooks de incidentes

## Objetivo

Ter runbooks mínimos, reais e acionáveis para os cenários de incidente mais
prováveis da NEXORA, para que a dona (owner único de operações nesta fase)
saiba o que fazer sem ter de reconstruir o raciocínio a meio de uma crise.

## Implementação

Criado `docs/RUNBOOKS.md` com os 11 cenários pedidos em
`NEXORA_PLANO_MESTRE_CONSTRUCAO_UI_SEM_CUSTOS.md` (Fase zero, `NEX-174`):
login indisponível, Supabase indisponível, deploy falhado, e-mail degradado,
reserva pública a falhar, erro de concorrência, Storage indisponível,
exportação financeira a falhar, suspeita de acesso cross-tenant, fuga de
token público, e restore de backup.

Cada runbook segue o esqueleto Deteção → Impacto → Contenção imediata →
Diagnóstico → Recuperação → Comunicação → Pós-incidente, e referencia
factos reais já confirmados no repositório em vez de passos genéricos:

- o incidente real de `NEX-172` (variáveis partilhadas Vercel) informa o
  runbook de "deploy falhado" e o de "login indisponível";
- o bug de concorrência real e o fix de `NEX-178` informam o runbook de
  "erro de concorrência", incluindo o teste de regressão existente
  (`tests/e2e/public-booking-race.spec.ts`);
- o mecanismo de backup de `NEX-173` (ainda com execução pendente da dona)
  informa o runbook de "restore de backup", com a limitação atual
  explicitamente referida (não escondida).

`docs/08_OPERATIONS.md` foi atualizado: a secção "Backups" passou a refletir
que produção está no plano Free (sem backups geridos do fornecedor) e aponta
para o mecanismo real de `NEX-173`; a secção "Runbooks mínimos" passou a
apontar para `docs/RUNBOOKS.md` em vez de ser só uma lista de títulos.

## Testes obrigatórios

- **Tabletop exercise**: percorri mentalmente cada um dos 11 runbooks contra
  o código/infraestrutura real do repositório (não apenas o texto do plano
  mestre) — confirmei nomes de ficheiros, rotas, nomes de eventos de log
  (`src/lib/logger.ts`/`src/lib/metrics.ts`) e comandos (`vercel env ls`,
  `supabase db dump`) citados existem tal como descritos.
- `npm run verify` passa (ver secção de verificação no fecho do lote).

## Critérios de aceite

- Runbooks mínimos cobrindo os 11 cenários pedidos: cumprido.
- Contactos: não aplicável — owner único (`ShadowShtr`) em todos os
  runbooks; não há equipa de suporte a listar nesta fase (ver `EPIC-19`
  para quando isso mudar).
- Nenhum dado de outro tenant pode ser acedido: não aplicável, é
  documentação.
- Logs não contêm segredos nem PII desnecessária: confirmado, os runbooks
  só referenciam nomes de variáveis/eventos, nunca valores.

## Segurança e privacidade

- Sem novo dado, entrada ou privilégio — só documentação.
- Runbook de "suspeita de acesso cross-tenant" e "fuga de token público"
  tratados como SEV1, com instrução explícita de não esperar por
  confirmação completa antes de conter — decisão consciente de errar do
  lado da contenção precoce.

## Definition of Done

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`
