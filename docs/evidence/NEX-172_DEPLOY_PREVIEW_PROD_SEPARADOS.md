# NEX-172 — Deploy Vercel e Supabase separados

## Estado final: critério de aceite **não cumprido**, por decisão explícita da dona

Esta tarefa não termina com "Preview/prod com secrets separados" — termina com
Preview e Produção a **partilhar** exatamente os mesmos segredos, tal como antes
de a tarefa começar. Ficou assim por decisão consciente, depois de uma tentativa
real de separação ter causado um incidente de produção. Documentado em detalhe
abaixo porque é informação real e importante para quem mexer nisto no futuro —
não só o que funcionou, também o que não funcionou e porquê.

## O que se descobriu ao investigar

- Existem **dois projetos "nexora" distintos no Vercel**, em equipas diferentes
  (`travizani-s-projects` e `shadowshtr-nexora`), mais um terceiro deployment
  visível nos checks de PR sob um scope `nextp` a que esta sessão não tem acesso
  nenhum. A dona confirmou já estar ciente disto e pediu para não mexer — não
  investigado mais a fundo.
- No projeto `travizani-s-projects/nexora` (o que recebe os deployments de
  preview desta sessão), **todas as variáveis de ambiente estavam configuradas
  como um único valor partilhado entre "Production" e "Preview"**, incluindo
  `SUPABASE_SERVICE_ROLE_KEY` — violação direta da regra já escrita em
  `docs/08_OPERATIONS.md` ("Nunca reutilizar service role de produção em
  preview").
- O projeto Supabase usado em `.env.local` para desenvolvimento local durante
  toda a sessão (`znakuwpmapkhzuntzorj`, org "vitorshadowmedina@gmail.com's
  Org") é **o mesmo** que aparece como o único projeto "NEXORA" visível no
  Supabase da dona — não existe um segundo projeto Supabase dedicado a
  Preview/dev distinto de produção, apesar de `docs/ENVIRONMENTS_AND_SECRETS.md`
  afirmar isso desde a `NEX-004`.

## O incidente

1. Tentativa de separar `NEXT_PUBLIC_SUPABASE_URL`: corri
   `vercel env rm NEXT_PUBLIC_SUPABASE_URL preview --yes`, esperando que isto
   retirasse só a associação ao ambiente "Preview", mantendo o valor em
   "Production". **O Vercel apagou a variável por completo, dos dois
   ambientes.** Confirmado duas vezes via `vercel env ls` (sem cache).
2. Sem forma de recuperar o valor original pela CLI (`vercel env pull` devolve
   string vazia para variáveis marcadas "Sensitive" — proteção do próprio
   Vercel, não um bug).
3. **Coincidência que resolveu o impasse**: o projeto Supabase que a dona foi
   verificar no dashboard (org "vitorshadowmedina@gmail.com's Org", projeto
   "NEXORA", API URL `znakuwpmapkhzuntzorj.supabase.co`) é exatamente o mesmo
   já presente em `.env.local` — permitiu repor o valor com confiança, sem
   adivinhar.
4. Enquanto isto decorria, um redeploy manual (acionado pela dona) confirmou o
   problema a sério: build falhou com `ZodError` em `NEXT_PUBLIC_SUPABASE_URL`
   (`src/lib/env.ts`, "expected string, received undefined") ao fim de ~50s,
   na fase "Collecting page data". **O Vercel não promoveu esta build falhada
   a produção** — o deployment anterior, funcional, continuou a servir tráfego
   sem interrupção durante todo o incidente. Confirmado via `vercel ls`
   (deployment "Ready" de 56 min antes continuava lá) e via login real feito
   pela dona depois da correção.
5. Ao corrigir via painel do Vercel (não CLI), tentando adicionar
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`/`BOOKING_DRAFT_ENCRYPTION_KEY` só para
   Preview, o mesmo problema aconteceu ao contrário: usar "Add New" com um nome
   de variável já existente **substituiu** o âmbito/valor do registo existente
   em vez de criar um segundo registo em paralelo — deixando, em momentos
   diferentes, ou Produção ou Preview sem a variável.
6. Decisão final (pedido explícito da dona, "faça só o mantimento de como já
   está sem muitas coisas extras"): repor as seis variáveis afetadas para
   "Production, Preview" partilhado, tal como estavam antes de qualquer
   alteração desta tarefa. Confirmado via `vercel env ls` — as seis mostram
   agora exatamente essa configuração. Login real confirmado pela dona depois.

## Porque não se tentou de novo com um projeto Supabase novo

A dona respondeu explicitamente que preferia reaproveitar o projeto de dev já
existente (não criar um projeto Supabase novo) e, depois do incidente, pediu
para manter tudo simples sem mexer mais. Dado o comportamento do Vercel
demonstrado aqui — operações aparentemente inofensivas (`env rm <nome>
<ambiente>`, `env add` num nome já existente) a afetarem **ambos** os ambientes
em vez de só um — qualquer nova tentativa precisa de um plano mais cuidadoso
(confirmar o comportamento exato numa variável não crítica primeiro, ou usar
sempre nomes de variável distintos por ambiente em vez do mesmo nome com âmbito
diferente) do que o que foi feito aqui ao vivo.

## Resultado

- Produção confirmada saudável (login real feito pela dona) depois da reposição.
- Nenhuma separação de segredos foi alcançada — risco residual aceite e
  documentado em `docs/ENVIRONMENTS_AND_SECRETS.md`.
- `BOOKING_DRAFT_ENCRYPTION_KEY` ficou com um valor diferente do original (o
  novo, gerado durante a tentativa) — impacto mínimo: só afeta a decifra de
  rascunhos de marcação já existentes no momento da troca (dado efémero,
  `NEX-052`/`NEX-161`), não dados de cliente permanentes nem qualquer outra
  funcionalidade.
- `docs/ENVIRONMENTS_AND_SECRETS.md` corrigido para descrever a realidade (um
  único projeto Supabase para Local e Preview, segredos partilhados entre
  Preview/Produção) em vez do estado pretendido/aspiracional que lá estava
  escrito desde a `NEX-004`.

## Testes

- "Deploy rehearsal" (exigido pela tarefa): aconteceu de facto, ainda que não
  planeado desta forma — duas builds de produção falhadas e recuperadas ao
  vivo, com o Vercel a demonstrar corretamente que nunca promove uma build
  falhada, e uma build bem-sucedida final confirmada com login real da dona.
- `npm run verify`: não há alterações de código nesta tarefa — só documentação.

## Riscos residuais

- Preview e Produção continuam a partilhar todos os segredos, incluindo a
  service role key — ver nota em `docs/ENVIRONMENTS_AND_SECRETS.md`. Aceitável
  agora (sem clientes reais em produção); revisitar antes do lançamento
  comercial, com um plano mais cuidadoso do que uma tentativa ao vivo.
- Os dois/três projetos Vercel "nexora" duplicados continuam por esclarecer —
  a dona já está ciente e pediu para não mexer nisto agora.
- `BOOKING_DRAFT_ENCRYPTION_KEY` já não corresponde ao valor original de
  produção (ver acima) — sem ação necessária, risco já absorvido.

## Próxima tarefa desbloqueada

NEX-173 — Backups e restore test (depende de NEX-172) — nota: esta dependência
presumia a separação Preview/Produção estar feita; reavaliar se isso muda algo
no âmbito da NEX-173 antes de a começar.
