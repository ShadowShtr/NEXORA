# NEX-140 — Central de definições em cartões

## Implementação

**Decisão de âmbito (confirmada com o dono)**: só reorganizar o que já existe nas 7 categorias pedidas, sem construir formulários novos para campos que hoje só se editam no onboarding (nome do negócio, morada, telefone, horário base) nem para conceitos sem nenhuma UI hoje (métodos de pagamento).

- `src/app/(dashboard)/dashboard/definicoes/page.tsx`: deixou de ser uma página plana com todos os cartões e passou a ser um **hub de navegação** — 7 cartões (ícone + nome + descrição curta), um por categoria, cada um a linkar para a sua própria subpágina.
- 7 subpáginas novas, cada uma com o seu próprio `requireProfile()` + consulta Supabase apenas com os campos de que precisa (mais focado do que a consulta monolítica anterior):
  - **`agenda/`** — Bloqueios de agenda (`AvailabilityBlocksManager`, NEX-124) + Horários especiais (`BusinessHoursExceptionsManager`, NEX-125), relocados sem alterações.
  - **`marcacoes/`** — Política de faltas (`NoShowPolicyForm`, NEX-095), relocada sem alterações.
  - **`lembretes/`** — Mensagem do lembrete (`ReminderTemplateForm`, NEX-104), relocada sem alterações.
  - **`aparencia/`** — Perfil público completo (imagens de capa/logótipo + `PublicProfileForm`), relocado sem alterações.
  - **`negocio/`**, **`pagamentos/`** — placeholder "Esta área fica disponível numa próxima atualização" (mesmo texto já usado antes nesta página) — nada existia para reorganizar.
  - **`dados/`** — placeholder com um link para `/dashboard/financeiro`, onde as exportações CSV/Excel/PDF (`NEX-132`–`135`) já vivem — não duplica a funcionalidade, só torna-a mais descobrível a partir de Definições.
- 6 server actions (`business-hours-exceptions-actions.ts`, `availability-blocks-actions.ts`, `public-profile-actions.ts`, `business-photo-actions.ts`, `template-actions.ts`, `no-show-policy-actions.ts`) tinham `revalidatePath('/dashboard/definicoes')` — atualizado para a subpágina certa (`/dashboard/definicoes/agenda`, `/aparencia`, `/lembretes`, `/marcacoes`), senão o cache da subpágina não invalidava depois de uma mutação.
- Comentário desatualizado em `mais/page.tsx` (dizia que o split "Meu negócio/Agenda e marcações/Aparência/Segurança" estava "deliberadamente por construir") corrigido — essa divisão é agora exatamente o que esta tarefa constrói, só que como subpáginas em vez de linhas separadas no menu "Mais".

## Testes

- `tests/e2e/definicoes-hub.spec.ts` (novo) — cobre o teste obrigatório desta tarefa ("Axe/mobile"): o `playwright.config.ts` já corre cada spec em dois projetos (`chromium` desktop e `webkit-mobile`, iPhone 15), por isso uma sondagem `AxeBuilder` por página cobre "Axe" e "mobile" ao mesmo tempo, sem precisar de um ficheiro só para mobile. Cobre: o hub lista as 7 categorias e navega corretamente (incluindo o botão "Voltar"); zero violações de acessibilidade automáticas em cada uma das 8 páginas (hub + 7 subpáginas).
- **Nota**: tal como os outros specs E2E já existentes neste repositório (`dashboard-shell.spec.ts`, etc.), este teste não corre no CI atual (não há job de Playwright configurado em `.github/workflows/`) — só localmente com Playwright + Supabase reais. Não é uma lacuna introduzida por esta tarefa, é o mesmo estado em que todos os specs E2E já existentes se encontravam.
- `npm run verify` (format, lint, typecheck, 396 testes, build) — ✅.
- UI não testada num browser real (mesma limitação já registada nas tarefas anteriores desta sessão).

## Resultado

`/dashboard/definicoes` passa a ser um hub navegável nas 7 categorias pedidas, em vez de uma lista crescente de cartões na mesma página. Nenhuma tabela, RPC ou funcionalidade nova — só reorganização de UI já existente.

## Riscos residuais

- 3 das 7 categorias (Negócio, Pagamentos, Dados) ficam com placeholder — decisão deliberada de âmbito, não uma lacuna esquecida. Construir esses formulários fica para tarefas futuras (fora do EPIC-14 atual, ou uma expansão explícita pedida pelo dono).
- Testes E2E (axe/mobile) não correm automaticamente no CI — mesma limitação de infraestrutura que já existia antes desta tarefa.

## Próxima tarefa desbloqueada

NEX-141 — Defaults e "usar recomendações" (depende de NEX-140, concluída).
