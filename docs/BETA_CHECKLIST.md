# Checklist de beta privado (NEX-176)

> Avaliação go/no-go para abrir a NEXORA a uma primeira dona real em beta
> privado, com base em evidência real do repositório — não em suposição.
> Cada item aponta para o `docs/evidence/NEX-*.md` ou teste que o comprova.
> Atualizar esta checklist sempre que um item mudar de estado.

## Legenda

- ✅ **Pronto** — implementado, testado, sem gap conhecido relevante para beta.
- 🟡 **Parcial** — implementado, mas com um gap real e conhecido (não escondido).
- ❌ **Em falta** — não existe ainda.

## Itens

| #   | Item                                    | Estado      | Evidência                                                                                                                                                                                                                                                                                                                                   |
| --- | --------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tenant de teste                         | 🟡 Parcial  | Provisionamento de tenant já é rotina testada (`scripts/provision-owner.mjs`, usado em toda a suite E2E); falta só a decisão/execução da dona de criar o tenant de beta em si — ação procedural, não técnica.                                                                                                                               |
| 2   | Serviços reais sem dados pessoais reais | 🟡 Parcial  | Mesma natureza do item 1 — prática operacional a seguir no momento de criar o tenant de beta (catálogo real de serviços, mas nomes/telefones de clientes fictícios até à beta ter clientes reais a sério).                                                                                                                                  |
| 3   | Onboarding completo                     | ✅ Pronto   | `EPIC-03` (`NEX-030`–`036`), wizard de 5 passos + teste de usabilidade, `docs/evidence/NEX-036_*.md`.                                                                                                                                                                                                                                       |
| 4   | Marcação pública                        | ✅ Pronto   | `EPIC-05`–`07`, fluxo paginado real (`docs/02_UX_FLOWS.md`, atualizado em `NEX-200`), reserva transacional protegida contra dupla marcação (`NEX-063`/`064`), testada sob carga real até 15 pedidos concorrentes (`NEX-175`) e com o bug de concorrência do cliente corrigido e coberto por E2E `@critical` em CI (`NEX-178`).              |
| 5   | Cancelamento/reagendamento              | ✅ Pronto   | `NEX-084`, `tests/e2e/appointment-detail.spec.ts`.                                                                                                                                                                                                                                                                                          |
| 6   | Lembrete                                | ✅ Pronto   | `EPIC-10` (`NEX-100`–`104`), deep link WhatsApp manual, `docs/evidence/NEX-102_*.md`/`NEX-104_*.md`.                                                                                                                                                                                                                                        |
| 7   | Conclusão                               | ✅ Pronto   | `EPIC-11`, testado em `tests/e2e/appointment-completion.spec.ts` (`@critical`). Bug real de desconto fixo (aplicava 1/100 do valor pretendido) encontrado e corrigido nesta mesma ronda (`NEX-204`) — hoje corrigido e coberto.                                                                                                             |
| 8   | Pendência                               | ✅ Pronto   | `NEX-114`, área de pagamentos pendentes no financeiro.                                                                                                                                                                                                                                                                                      |
| 9   | Exportação                              | ✅ Pronto   | `EPIC-13` (`NEX-132`–`135`), CSV/Excel/PDF com regras de retenção.                                                                                                                                                                                                                                                                          |
| 10  | PWA Android/iOS                         | 🟡 Parcial  | Manifest, ícones (incl. maskable), `standalone` real no iOS e caminho de instalação guiado implementados e verificados por leitura de HTML/manifest (`NEX-152`). **Nunca testado num dispositivo Android/iOS físico real** — risco residual já registado em `docs/evidence/NEX-152_MANIFEST_INSTALACAO_PWA.md`, não resolvido desde então.  |
| 11  | Testes de backup                        | 🟡 Parcial  | Mecanismo pronto nesta mesma ronda (`NEX-173`): workflow de dump/restore/verificação em CI, produção confirmada no plano Free (sem backup automático do fornecedor). **Sem execução real ainda** — falta a dona adicionar o secret `BACKUP_SOURCE_DATABASE_URL` e disparar o workflow. Ver `docs/evidence/NEX-173_BACKUPS_RESTORE_TEST.md`. |
| 12  | Política de privacidade                 | ❌ Em falta | Não existe nenhuma rota/página de política de privacidade no código (`grep` confirma). `docs/05_SECURITY_PRIVACY.md` existe como documento técnico interno, mas não é uma página pública para clientes/visitantes lerem antes de partilhar dados pessoais na marcação pública.                                                              |
| 13  | Suporte                                 | ❌ Em falta | Não existe centro de ajuda nem formulário de feedback (`EPIC-30`, ainda por implementar). `CLAUDE.md` proíbe explicitamente inventar uma secção de Suporte sem destino real — por isso a página "Mais" hoje não a mostra, corretamente.                                                                                                     |

## Conclusão — NO-GO por agora

Quatro itens não estão prontos para uma beta com uma dona e clientes reais:

- **Bloqueadores diretos de conformidade/confiança** (12, 13): sem política
  de privacidade pública, pedir dados pessoais reais (nome, telefone,
  eventualmente fotografias) a clientes reais na marcação pública é um risco
  de conformidade real, não só cosmético. Sem nenhum canal de suporte, uma
  dona real em beta não tem para onde reportar um problema.
- **Bloqueadores de recuperação de desastre** (11): sem uma execução real do
  mecanismo de backup, não há garantia comprovada de recuperação se algo
  correr mal com dados reais de clientes.
- **Risco aceitável mas registado** (10): a instalação PWA nunca foi
  confirmada num dispositivo físico — menos crítico que os anteriores (a app
  continua a funcionar como site normal sem instalação), mas deve ser
  validado antes de prometer a experiência de app à dona.
- Itens 1/2 são puramente operacionais (decisão da dona no dia de criar o
  tenant de beta), não bloqueiam o código.

**Recomendação**: resolver 11, 12 e 13 (nesta ordem de risco) antes de
convidar a primeira dona real para uma beta com clientes reais. Item 10 pode
ser validado em paralelo, não bloqueia sozinho.

## Próximos passos concretos

1. Disparar `NEX-173` até ao fim (secret + `workflow_dispatch` real).
2. Escrever uma política de privacidade real (mesmo que simples) e publicá-la
   como página real, ligada no rodapé da marcação pública e no login —
   trabalho jurídico/de conteúdo, não só técnico (ver `docs/05_SECURITY_PRIVACY.md`
   para a base já documentada a converter em texto para o público).
3. Decidir o canal de suporte mínimo real para a fase de beta (mesmo que seja
   só "WhatsApp/e-mail direto da dona", mas documentado e visível) — não
   precisa de esperar pelo `EPIC-30` completo.
4. Testar a instalação PWA num Android e num iPhone físicos reais.
