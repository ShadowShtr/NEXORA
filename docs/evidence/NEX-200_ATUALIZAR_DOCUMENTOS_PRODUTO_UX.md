# NEX-200 — Atualizar documentos de produto e UX

## Objetivo

Eliminar divergências entre a documentação e o estado real do repositório
antes de expandir o produto (`EPIC-18`, primeira tarefa).

## Lacunas encontradas e corrigidas

1. **`README.md`** descrevia o repositório como "esqueleto inicial
   TypeScript/Next.js/PWA" e ainda apontava para `scripts/publish-to-github.sh`
   (repositório `ltd-tech/nexora`, nunca usado — o real é
   `github.com/ShadowShtr/NEXORA`, já publicado e protegido). Reescrito para
   descrever o estado real: EPIC-00 a EPIC-16 completos em produção, EPIC-17
   quase completo, deploy automático Vercel↔GitHub, branch `main` protegida.
   Adicionada a distinção explícita "pacote de serviços" vs. "pack de
   sessões" pedida pelo plano mestre.
2. **`docs/02_UX_FLOWS.md`** tinha uma secção ("Estado de implementação da
   página pública") que descrevia o Fluxo B como parcialmente por construir
   — "escolha de horário depende do motor de disponibilidade, `EPIC-06`,
   ainda não construído" e "a confirmação é só um link `wa.me`". Isto está
   desatualizado desde `NEX-064`/`NEX-070`. Reescrita para descrever o fluxo
   público paginado real (`/b/{slug}/servicos` → `/horario` → `/dados` →
   `/resumo`), o Route Handler de reserva transacional/idempotente, a
   proteção contra dupla marcação, e a cobertura E2E crítico em CI.
3. **`docs/01_PRODUCT_REQUIREMENTS.md`** (secção 15, "Fora do MVP") ainda
   listava "equipas e comissões na interface" como fora de âmbito — o mesmo
   texto que foi removido do `CLAUDE.md` nesta integração do plano mestre.
   Reescrita a secção item a item, marcando o que continua fora, o que foi
   parcialmente endereçado pelo plano mestre, e o que deixou de estar fora
   de âmbito (equipas/comissões, área do cliente por link).
4. **`docs/03_ARCHITECTURE.md`** e **`docs/04_DATA_MODEL.md`** — revistos,
   sem linguagem desatualizada encontrada (grep por "a implementar",
   "planeado", "ainda por" sem resultados).
5. **`TASKS.md`** — já refletia o estado real via checkboxes por tarefa; sem
   alteração adicional nesta tarefa além da integração do plano mestre já
   feita.

## Testes obrigatórios

- Verificação de links internos: referências cruzadas (`TASKS.md`,
  `tasks/epics/`, `docs/evidence/`) revistas manualmente nos ficheiros
  alterados.
- Revisão cruzada da documentação contra rotas reais
  (`src/app/b/[slug]/servicos|horario|dados|resumo`, confirmado no output
  de `next build` desta sessão) e contra os testes existentes
  (`tests/e2e/`, `@critical`).
- `npm run verify` passa (ver fecho do lote).

## Definition of Done

- [x] Implementação concluída
- [x] Testes concluídos
- [x] Documentação atualizada
- [x] Critérios de aceite validados
- [x] Tarefa marcada no `TASKS.md`
