# NEX-143 — Confirmações e desfazer

## Implementação

**Nota**: `NEX-142` (pré-visualização) foi explicitamente deixada de fora por decisão da dona — `NEX-143` só depende de `NEX-140`, não de `NEX-142`, por isso não fica bloqueada.

- **Ações destrutivas confirmam** — auditoria aos "Remover" introduzidos nesta sessão (`NEX-124`/`125`) encontrou 3 que submetiam de imediato, sem nenhuma confirmação (ao contrário do padrão já estabelecido em `AppointmentDetailActions.tsx`, NEX-084/115/123 — revelar em dois passos, nunca `window.confirm()`):
  - `AvailabilityBlocksManager.tsx` — remover um bloqueio.
  - `BusinessHoursExceptionsManager.tsx` — remover um horário especial.
  - `BusinessImageUpload.tsx` — remover logótipo/capa.

  Os três passam agora a seguir o mesmo padrão de dois passos: primeiro clique em "Remover" revela "Tem a certeza?" (texto específico por caso) com "Sim, remover"/"Cancelar"; só o segundo clique executa. Nenhuma RPC/action foi alterada — só a UI que as invoca.

- **Ações reversíveis oferecem undo** — já satisfeito pelo "Desfazer" da `NEX-141` (regras da agenda: "Usar recomendações" + "Desfazer"), a única ação claramente reversível-sem-confirmação nesta área. Não há nada novo a construir aqui.

## Testes

- `tests/e2e/settings-destructive-confirm.spec.ts` (novo) — cobre o teste obrigatório desta tarefa ("E2E"): cria um bloqueio de agenda e um horário especial, confirma que "Remover" só revela a confirmação (nada é removido ainda), que "Cancelar" mantém o item, e que "Sim, remover" o remove de facto. Cobre os dois casos baseados em lista (bloqueios, horários especiais); a remoção de imagem recebeu a mesma correção no código mas não tem E2E dedicado — testá-la exigiria um ficheiro de imagem fixture só para provar o mesmo padrão já coberto duas vezes.
- **Nota**: tal como os restantes specs E2E deste repositório, não corre no CI atual (sem job de Playwright configurado) — mesma limitação já registada em `NEX-140`/`NEX-141`.
- `npm run verify` (format, lint, typecheck, 399 testes, build) — ✅.
- UI não testada num browser real (mesma limitação já registada nas tarefas anteriores desta sessão).

## Resultado

As três ações de remoção introduzidas nesta sessão em Definições passam a exigir confirmação explícita, consistentes com o padrão já usado no resto da aplicação. "Desfazer" para ações reversíveis já existia (NEX-141).

## Riscos residuais

Nenhum novo.

## Próxima tarefa desbloqueada

NEX-144 — Ajuda contextual curta (depende de NEX-140, já concluída — não bloqueada por esta tarefa, mas relacionada).
