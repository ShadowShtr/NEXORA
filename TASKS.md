# TASKS — Backlog executável da NEXORA

> Regra: só marcar `[x]` após cumprir todos os critérios do épico, executar testes e atualizar documentação.

## Legenda

- `[ ]` pendente
- `[~]` em execução
- `[x]` concluída
- `[!]` bloqueada

## Ordem de execução

### EPIC-00 — Governança e fundação do repositório

- [x] **NEX-001** — Validar bootstrap e versões _(depende: Nenhuma)_
- [x] **NEX-002** — Configurar proteção de qualidade _(depende: NEX-001)_
- [x] **NEX-003** — Configurar repositório GitHub _(depende: NEX-001)_
- [x] **NEX-004** — Documentar ambientes e segredos _(depende: NEX-001)_
- [x] **NEX-005** — Estabelecer ADR e processo de mudanças _(depende: NEX-002)_

### EPIC-01 — Supabase, dados e isolamento

- [x] **NEX-010** — Inicializar Supabase local _(depende: NEX-001)_
- [x] **NEX-011** — Rever e endurecer schema inicial _(depende: NEX-010)_
- [x] **NEX-012** — Implementar RLS tenant-scoped _(depende: NEX-010)_
- [x] **NEX-013** — Implementar provisioning de tenant/owner _(depende: NEX-012)_
- [x] **NEX-014** — Implementar auditoria append-only _(depende: NEX-012)_
- [x] **NEX-015** — Criar testes automatizados de isolamento _(depende: NEX-012)_

### EPIC-02 — Autenticação e sessão da dona

- [x] **NEX-020** — Implementar login e logout _(depende: NEX-013)_
- [x] **NEX-021** — Implementar recuperação de palavra-passe _(depende: NEX-020)_
- [x] **NEX-022** — Proteger rotas privadas _(depende: NEX-020)_
- [x] **NEX-023** — Implementar shell responsivo autenticado _(depende: NEX-022)_

### EPIC-03 — Onboarding guiado da dona

- [x] **NEX-030** — Criar motor de wizard persistente _(depende: NEX-022)_
- [x] **NEX-031** — Passo negócio e morada fixa _(depende: NEX-030)_
- [x] **NEX-032** — Passo horários de trabalho _(depende: NEX-030)_
- [x] **NEX-033** — Passo serviços iniciais _(depende: NEX-030)_
- [x] **NEX-034** — Passo regras recomendadas _(depende: NEX-030)_
- [x] **NEX-035** — Passo publicar link e QR Code _(depende: NEX-031,NEX-033,NEX-034)_
- [x] **NEX-036** — Teste de usabilidade do onboarding _(depende: NEX-035)_

### EPIC-04 — Catálogo de serviços e pacotes

- [x] **NEX-040** — CRUD de categorias _(depende: NEX-012,NEX-023)_
- [x] **NEX-041** — CRUD de serviços _(depende: NEX-040)_
- [x] **NEX-042** — CRUD de pacotes _(depende: NEX-041)_
- [x] **NEX-043** — Regras de combinação pacote/extras _(depende: NEX-042)_
- [x] **NEX-044** — Interface extremamente simples de catálogo _(depende: NEX-043)_

### EPIC-05 — Página pública e pré-cadastro

- [x] **NEX-050** — Criar página pública por slug _(depende: NEX-035)_
- [x] **NEX-051** — Criar pré-cadastro temporário _(depende: NEX-050)_
- [x] **NEX-052** — Implementar draft e recuperação _(depende: NEX-051)_
- [x] **NEX-053** — Criar seletor Serviços/Pacotes _(depende: NEX-043,NEX-050)_
- [x] **NEX-054** — Criar carrinho fixo _(depende: NEX-053)_

### EPIC-06 — Motor de disponibilidade

- [x] **NEX-060** — Modelar horários e exceções _(depende: NEX-011,NEX-032)_
- [x] **NEX-061** — Implementar gerador de slots timezone-aware _(depende: NEX-060)_
- [x] **NEX-062** — Implementar consulta pública de disponibilidade _(depende: NEX-061,NEX-054)_
- [x] **NEX-063** — Implementar constraint de não sobreposição _(depende: NEX-011)_
- [x] **NEX-064** — Implementar booking transacional/idempotente _(depende: NEX-063,NEX-051)_
- [x] **NEX-065** — Tratar SLOT_TAKEN na UX _(depende: NEX-064)_
- [x] **NEX-066** — Rate limit e bot protection _(depende: NEX-064)_

### EPIC-07 — Confirmação e link da marcação

- [x] **NEX-070** — Criar ecrã final de confirmação _(depende: NEX-064)_
- [x] **NEX-071** — Criar link público seguro _(depende: NEX-064)_
- [x] **NEX-072** — Gerar ficheiro ICS _(depende: NEX-071)_
- [x] **NEX-073** — Implementar abrir localização _(depende: NEX-071)_
- [x] **NEX-074** — Implementar e-mail opcional _(depende: NEX-071)_

### EPIC-08 — Dashboard e agenda da dona

- [x] **NEX-080** — Dashboard combinado _(depende: NEX-023,NEX-064)_
- [x] **NEX-081** — Cartões de marcação _(depende: NEX-080)_
- [x] **NEX-082** — Visualizações dia/semana/mês _(depende: NEX-080)_
- [x] **NEX-083** — Resumo/lista de horários livres _(depende: NEX-061,NEX-080)_
- [x] **NEX-084** — Detalhes, cancelar e reagendar _(depende: NEX-081)_
- [x] **NEX-085** — Marcação manual completa _(depende: NEX-041,NEX-061,NEX-080)_

### EPIC-09 — Clientes e histórico

- [x] **NEX-090** — Lista e pesquisa de clientes _(depende: NEX-064,NEX-023)_
- [x] **NEX-091** — Ficha completa da cliente _(depende: NEX-090)_
- [x] **NEX-092** — Sugestão/deduplicação no booking manual _(depende: NEX-090,NEX-085)_
- [x] **NEX-093** — Observações privadas _(depende: NEX-091)_
- [x] **NEX-094** — Fotografias privadas _(depende: NEX-091)_
- [x] **NEX-095** — Política configurável de faltas _(depende: NEX-091)_

### EPIC-10 — Lembretes e WhatsApp manual

- [x] **NEX-100** — Gerar lembrete 24h _(depende: NEX-064)_
- [x] **NEX-101** — Lista de lembretes pendentes _(depende: NEX-100,NEX-080)_
- [x] **NEX-102** — Gerar deep link WhatsApp _(depende: NEX-101)_
- [x] **NEX-103** — Registar aberto e marcado enviado _(depende: NEX-102)_
- [x] **NEX-104** — Personalizar template simples _(depende: NEX-102)_

### EPIC-11 — Conclusão, pagamentos e pendências

- [x] **NEX-110** — Modal de conclusão rápida _(depende: NEX-081)_
- [x] **NEX-111** — Tela Ver mais e extras _(depende: NEX-110)_
- [x] **NEX-112** — Descontos fixos/percentuais _(depende: NEX-111)_
- [x] **NEX-113** — Transação de conclusão _(depende: NEX-110)_
- [x] **NEX-114** — Área de pagamentos pendentes _(depende: NEX-113)_
- [x] **NEX-115** — Reabrir/corrigir com auditoria _(depende: NEX-113)_

### EPIC-12 — Recorrência e disponibilidade avançada

- [x] **NEX-120** — Gerador de recorrências _(depende: NEX-061,NEX-085)_
- [x] **NEX-121** — Detetar conflitos e alternativas _(depende: NEX-120)_
- [x] **NEX-122** — Criar série atomicamente _(depende: NEX-121)_
- [x] **NEX-123** — Editar escopo da série _(depende: NEX-122)_
- [x] **NEX-124** — Bloqueios completos _(depende: NEX-060,NEX-082)_
- [x] **NEX-125** — Horários especiais _(depende: NEX-124)_

### EPIC-13 — Financeiro e relatórios

- [x] **NEX-130** — Dashboard financeiro _(depende: NEX-113)_
- [x] **NEX-131** — Filtros por período _(depende: NEX-130)_
- [x] **NEX-132** — Exportar CSV _(depende: NEX-131)_
- [x] **NEX-133** — Exportar Excel _(depende: NEX-131)_
- [x] **NEX-134** — Exportar PDF _(depende: NEX-131)_
- [x] **NEX-135** — Regras de retenção/exportação _(depende: NEX-132,NEX-133,NEX-134)_

### EPIC-14 — Definições e simplicidade operacional

- [x] **NEX-140** — Central de definições em cartões _(depende: NEX-023,NEX-035)_
- [x] **NEX-141** — Defaults e “usar recomendações” _(depende: NEX-140)_
- [x] **NEX-142** — Pré-visualização da página pública _(depende: NEX-140)_
- [x] **NEX-143** — Confirmações e desfazer _(depende: NEX-140)_
- [x] **NEX-144** — Ajuda contextual curta _(depende: NEX-140)_

### EPIC-15 — PWA, design e acessibilidade

- [x] **NEX-150** — Design system claymorphism _(depende: NEX-023)_
- [x] **NEX-151** — Navegação mobile e desktop _(depende: NEX-150)_
- [x] **NEX-152** — Manifest e instalação PWA _(depende: NEX-150)_
- [x] **NEX-153** — Estratégia de cache segura _(depende: NEX-152)_
- [x] **NEX-154** — Auditoria WCAG 2.2 AA _(depende: NEX-151)_
- [x] **NEX-155** — Performance e Web Vitals _(depende: NEX-151)_

### EPIC-16 — Privacidade, segurança e direitos

- [x] **NEX-160** — Data map e subprocessadores _(depende: NEX-004,NEX-011)_
- [x] **NEX-161** — Retenção e limpeza de drafts _(depende: NEX-052)_
- [x] **NEX-162** — Exportar dados da cliente _(depende: NEX-091)_
- [x] **NEX-163** — Apagar/anonimizar cliente _(depende: NEX-091,NEX-094)_
- [x] **NEX-164** — Headers/CSP completos _(depende: NEX-023)_
- [x] **NEX-165** — Hardening uploads _(depende: NEX-094)_
- [x] **NEX-166** — Threat model atualizado e security review _(depende: NEX-115,NEX-135,NEX-164)_
- [x] **NEX-167** — Pentest proporcional _(depende: NEX-166)_

### EPIC-17 — Observabilidade, CI/CD e lançamento

- [x] **NEX-170** — Logs estruturados e redaction _(depende: NEX-004)_
- [x] **NEX-171** — Métricas e alertas _(depende: NEX-170)_
- [!] **NEX-172** — Deploy Vercel e Supabase separados _(depende: NEX-003,NEX-010)_ — tentado, revertido após incidente real de produção; segredos continuam partilhados entre Preview/Produção por decisão da dona (`docs/evidence/NEX-172_DEPLOY_PREVIEW_PROD_SEPARADOS.md`)
- [~] **NEX-173** — Backups e restore test _(depende: NEX-172)_ — mecanismo pronto (workflow `.github/workflows/backup-restore-test.yml`, dump lógico + restore efémero + verificação de integridade em CI), Free tier confirmado sem backups automáticos do fornecedor; falta só a dona adicionar o secret `BACKUP_SOURCE_DATABASE_URL` e disparar um run real — ver `docs/evidence/NEX-173_BACKUPS_RESTORE_TEST.md`
- [x] **NEX-174** — Runbooks de incidentes _(depende: NEX-171,NEX-173)_ — `docs/RUNBOOKS.md` com os 11 cenários (login, Supabase, deploy, e-mail, reserva pública, concorrência, Storage, exportação, cross-tenant, token público, restore); ver `docs/evidence/NEX-174_RUNBOOKS_INCIDENTES.md`
- [x] **NEX-175** — Load/concurrency test _(depende: NEX-064,NEX-155)_
- [x] **NEX-176** — Checklist beta privado _(depende: NEX-154,NEX-167,NEX-175)_ — `docs/BETA_CHECKLIST.md`, 13 itens avaliados com evidência real; conclusão **NO-GO** para clientes reais até backup real, política de privacidade e canal de suporte existirem; ver `docs/evidence/NEX-176_CHECKLIST_BETA_PRIVADO.md`
- [x] **NEX-177** — Lançamento e monitorização inicial _(depende: NEX-176)_ — secção em `docs/09_RELEASE_PLAN.md` (métricas reais, rotina diária, critérios de rollback); ver `docs/evidence/NEX-177_LANCAMENTO_MONITORIZACAO_INICIAL.md`
- [x] **NEX-178** — Corrigir concorrência do cliente em `/resumo` e adicionar E2E ao CI _(depende: NEX-065,NEX-175)_ — bug do cliente React e deadlock do Postgres corrigidos e mesclados (#138). Job `e2e-critical` implementado e mesclado (#139, `.github/workflows/ci.yml`: build de produção + `supabase start` + `playwright test --grep @critical`, 6 specs `@critical`), provado a passar no GitHub Actions real (3m47s, sem falhas). Proteção de branch do `main` configurada (ruleset ativo, `strict_required_status_checks_policy`) a exigir `verify`/`integration`/`E2E crítico`/`gitleaks`/`analyze` antes de mesclar — confirmado via API (`gh api repos/ShadowShtr/NEXORA/rulesets`). Ver `docs/evidence/NEX-178_PUBLIC_BOOKING_CLIENT_CONCURRENCY.md` para o relato completo, incluindo o achado de que `appointment-completion.spec.ts` (NEX-110) estava genuinamente partido (redesign da agenda para bottom sheet nunca refletido no teste, só descoberto porque o E2E finalmente correu) e foi corrigido no processo. Gaps encontrados mas fora do âmbito desta tarefa, ficam para seguimento: falta spec E2E completa de NEX-085 (criação manual de marcação, só existe a parcial NEX-092); `appointment-completion-discount.spec.ts`, `appointment-completion-extras.spec.ts` e `appointment-card.spec.ts` têm o mesmo padrão desatualizado do NEX-110 mas não foram corrigidas (não são `@critical`, não bloqueiam o CI, mas estão partidas se alguém as correr)

### EPIC-18 — Alinhar documentação, QA e design foundations

- [x] **NEX-200** — Atualizar documentos de produto e UX _(depende: Nenhuma)_ — README/`02_UX_FLOWS`/`01_PRODUCT_REQUIREMENTS` deixam de descrever "esqueleto inicial"/fluxo público por construir; distinção pacote-de-serviços vs. pack-de-sessões explícita; ver `docs/evidence/NEX-200_ATUALIZAR_DOCUMENTOS_PRODUTO_UX.md`
- [x] **NEX-201** — Inventário único de funcionalidades e rotas _(depende: NEX-200)_ — `docs/FEATURE_ROUTE_INVENTORY.md`, 14 secções/~125 linhas, levantado do código real (rotas, actions/RPC, tabelas, testes); ver `docs/evidence/NEX-201_INVENTARIO_FUNCIONALIDADES_ROTAS.md`
- [x] **NEX-202** — Tokenizar espaçamento, radius e elevação _(depende: NEX-150)_ — tokens `--space-*`/`--radius-*` em `globals.css`, aplicados a Button/Card/BottomSheet/FilterChip onde o valor batia certo (zero mudança visual); PageHeader/MetricCard sem componente ou valor alinhado — ver `docs/evidence/NEX-202_TOKENIZAR_ESPACAMENTO_RADIUS.md`
- [~] **NEX-203** — Criar harness de regressão visual _(depende: NEX-202)_ — `visual-regression.spec.ts` cobre as 16 páginas, mecânica provada localmente (16/16 sem erro); falta a dona disparar `workflow_dispatch update=true` para gerar as baselines Linux reais — ver `docs/evidence/NEX-203_HARNESS_REGRESSAO_VISUAL.md`
- [x] **NEX-204** — Corrigir specs E2E não críticas desatualizadas _(depende: NEX-178)_ — 3 specs corrigidas para o bottom sheet real; encontrado e corrigido bug real (desconto fixo aplicado a 1/100 do valor) em `AppointmentCompletionPanel.tsx`; ver `docs/evidence/NEX-204_CORRIGIR_SPECS_E2E_DESATUALIZADAS.md`
- [x] **NEX-205** — E2E completo da criação manual _(depende: NEX-085,NEX-204)_ — `manual-booking-wizard-complete.spec.ts` (`@critical`, 2 testes) cobre todos os ramos; encontrado e **corrigido** bug real no motor de disponibilidade (vaga de "hoje" ancorada ao milissegundo de `Date.now()` quando decidida por `min_notice_hours`, não arredondada à grelha — quebrava a verificação de conflitos de recorrência, `R13`); ver `docs/evidence/NEX-205_E2E_COMPLETO_CRIACAO_MANUAL.md` e `docs/evidence/NEX-205_FIX_MOTOR_DISPONIBILIDADE.md`

### EPIC-19 — Equipas, prestadores, salas e equipamentos

- [~] **NEX-210** — Modelo de membros, prestadores e roles _(depende: NEX-012,NEX-013)_ — `profiles` estendido em vez de `tenant_members` paralela (`ADR-011`); `service_providers` + `assert_not_last_owner`; testes de integração escritos mas só correm de facto no CI (sem Docker/DB direta neste ambiente); ver `docs/evidence/NEX-210_MODELO_MEMBROS_PRESTADORES_ROLES.md`
- [x] **NEX-211** — Matriz de permissões _(depende: NEX-210)_ — `docs/PERMISSION_MATRIX.md` + `hasPermission()` (`src/lib/auth/permissions.ts`), 73/73 testes unitários confirmando a matriz linha a linha; ver `docs/evidence/NEX-211_MATRIZ_PERMISSOES.md`
- [~] **NEX-212** — Provisionamento de colaborador _(depende: NEX-211)_ — mecanismo de convite (token hash, expiração, uso único, rate limit) pronto; UI/página de aceitação fica para `NEX-217`; testes de integração escritos, execução real pendente do CI; ver `docs/evidence/NEX-212_PROVISIONAMENTO_COLABORADOR.md`
- [~] **NEX-213** — Horários por prestador _(depende: NEX-210,NEX-060)_ — `provider_business_hours`/`_exceptions` + `availability_blocks.provider_id`; herança por dia da semana (`resolveProviderDayHours`) verificada com 5/5 testes unitários reais; schema/RLS pendentes de confirmação no CI; ver `docs/evidence/NEX-213_HORARIOS_POR_PRESTADOR.md`
- [~] **NEX-214** — Serviços por prestador _(depende: NEX-210)_ — `provider_services` N:N + `resolveEffectiveProviderService` (fallback preço/duração) verificado com 5/5 testes unitários reais; schema/RLS pendentes de confirmação no CI; ver `docs/evidence/NEX-214_SERVICOS_POR_PRESTADOR.md`
- [~] **NEX-215** — Salas e equipamentos _(depende: NEX-210)_ — `resources`/`resource_services`; `appointments_no_overlap` dividida em 3 exclusões (prestador/recurso/tenant-wide, `ADR-012`) — achado real: a constraint antiga era tenant-wide, incompatível com vários prestadores; testes escritos, execução real pendente do CI; ver `docs/evidence/NEX-215_SALAS_EQUIPAMENTOS.md`
- [~] **NEX-216** — Motor de disponibilidade multi-recurso _(depende: NEX-061,NEX-213,NEX-214,NEX-215)_ — `generateMultiResourceSlots`/`isWithinOpenHours`/`classifyOverlapConstraintViolation` em `multi-resource-availability.ts`; 10 testes unitários reais a passar; falta integração com a rota de escrita real; ver `docs/evidence/NEX-216_MOTOR_DISPONIBILIDADE_MULTI_RECURSO.md`
- [~] **NEX-217** — UI da página Equipa e Recursos _(depende: NEX-212,NEX-213,NEX-214,NEX-215)_ — página `/dashboard/equipa` (Mais/Sidebar → Gestão), tabs Pessoas/Salas e equipamentos/Permissões, wizard de 4 passos; sem editor de horário próprio por prestador nem página de aceitação de convite ainda; verificação visual/axe real não foi possível neste ambiente; ver `docs/evidence/NEX-217_UI_EQUIPA_RECURSOS.md`
- [~] **NEX-218** — Integração visual na Agenda _(depende: NEX-082,NEX-216)_ — filtros Todos/Eu/prestador/Recursos, faixa lateral de 4px por cor do prestador, indicador por quantidade na vista Lista; sem grelha de calendário (nunca existiu nesta base de código, decisão documentada); verificação visual real não foi possível; ver `docs/evidence/NEX-218_INTEGRACAO_VISUAL_AGENDA.md`
- [~] **NEX-219** — Testes e métricas de equipas/recursos _(depende: NEX-216,NEX-217,NEX-218)_ — cobertura mapeada (a maior parte já existia via NEX-210-215/211); novos testes de ciclo de vida de membro e métricas de utilização; achado real: `hasPermission` ainda não está aplicado a páginas antigas (Financeiro, Agenda) — risco residual documentado; ver `docs/evidence/NEX-219_TESTES_METRICAS_EQUIPAS_RECURSOS.md`

### EPIC-20 — Área do cliente por link seguro

- [ ] **NEX-220** — Token de acesso da cliente _(depende: NEX-091)_
- [ ] **NEX-221** — Resolver cliente por token _(depende: NEX-220)_
- [ ] **NEX-222** — Página inicial da área do cliente _(depende: NEX-221)_
- [ ] **NEX-223** — Próximas marcações na área do cliente _(depende: NEX-222)_
- [ ] **NEX-224** — Histórico e repetir marcação _(depende: NEX-222)_
- [ ] **NEX-225** — Perfil editável limitado _(depende: NEX-222)_
- [ ] **NEX-226** — Partilha manual pela dona _(depende: NEX-220)_
- [ ] **NEX-227** — Instalação PWA da área do cliente _(depende: NEX-152,NEX-222)_
- [ ] **NEX-228** — Segurança da área do cliente _(depende: NEX-220,NEX-221)_
- [ ] **NEX-229** — Testes e métricas da área do cliente _(depende: NEX-223,NEX-224,NEX-225,NEX-228)_

### EPIC-21 — Packs de sessões, vouchers e fidelização

- [ ] **NEX-230** — Modelar produtos de pack _(depende: Nenhuma)_
- [ ] **NEX-231** — Pack adquirido pela cliente _(depende: NEX-230)_
- [ ] **NEX-232** — Consumo de sessão _(depende: NEX-113,NEX-231)_
- [ ] **NEX-233** — UI em Serviços — Packs de sessões _(depende: NEX-230)_
- [ ] **NEX-234** — UI na ficha do cliente — Packs _(depende: NEX-091,NEX-231)_
- [ ] **NEX-235** — Alertas de validade de packs _(depende: NEX-231)_
- [ ] **NEX-236** — Vouchers e cartões-oferta _(depende: Nenhuma)_
- [ ] **NEX-237** — UI de vouchers _(depende: NEX-236)_
- [ ] **NEX-238** — Fidelização simples _(depende: NEX-113)_
- [ ] **NEX-239** — Testes e métricas de packs/vouchers _(depende: NEX-232,NEX-236,NEX-238)_

### EPIC-22 — Caixa interna, dívidas e comprovativos

- [ ] **NEX-240** — Sessão de caixa _(depende: NEX-013)_
- [ ] **NEX-241** — Movimentos de caixa _(depende: NEX-240)_
- [ ] **NEX-242** — Dívidas e vencimento _(depende: NEX-114)_
- [ ] **NEX-243** — Comprovativo de pagamento manual _(depende: NEX-242)_
- [ ] **NEX-244** — Comprovativo interno PDF _(depende: NEX-134,NEX-243)_
- [ ] **NEX-245** — UI Financeiro — Caixa e pendentes _(depende: NEX-130,NEX-241,NEX-242)_
- [ ] **NEX-246** — Fluxo de regularização _(depende: NEX-242,NEX-243)_
- [ ] **NEX-247** — Aging report _(depende: NEX-242)_
- [ ] **NEX-248** — Segurança de comprovativos e caixa _(depende: NEX-241,NEX-243)_
- [ ] **NEX-249** — Testes e métricas de caixa/dívidas _(depende: NEX-245,NEX-246,NEX-247,NEX-248)_

### EPIC-23 — Produtos, stock, fornecedores e compras

- [ ] **NEX-250** — Catálogo de produtos _(depende: NEX-013)_
- [ ] **NEX-251** — Movimentos de stock _(depende: NEX-250)_
- [ ] **NEX-252** — Receitas/consumo por serviço _(depende: NEX-113,NEX-250)_
- [ ] **NEX-253** — Fornecedores _(depende: NEX-250)_
- [ ] **NEX-254** — Compras internas _(depende: NEX-251,NEX-253)_
- [ ] **NEX-255** — UI em Serviços — Produtos _(depende: NEX-251)_
- [ ] **NEX-256** — Página Stock _(depende: NEX-251,NEX-254)_
- [ ] **NEX-257** — Scanner sem serviço externo _(depende: NEX-255)_
- [ ] **NEX-258** — Alertas internos de stock _(depende: NEX-251)_
- [ ] **NEX-259** — Testes e métricas de stock _(depende: NEX-252,NEX-256,NEX-258)_

### EPIC-24 — Comissões e desempenho da equipa

- [ ] **NEX-260** — Regras de comissão _(depende: NEX-214)_
- [ ] **NEX-261** — Snapshot de comissão _(depende: NEX-113,NEX-260)_
- [ ] **NEX-262** — Períodos e estados de comissão _(depende: NEX-261)_
- [ ] **NEX-263** — UI Financeiro — Comissões _(depende: NEX-130,NEX-262)_
- [ ] **NEX-264** — UI no perfil da equipa — Comissões _(depende: NEX-217,NEX-262)_
- [ ] **NEX-265** — Ajustes de comissão _(depende: NEX-262)_
- [ ] **NEX-266** — Permissões de comissão _(depende: NEX-211,NEX-263)_
- [ ] **NEX-267** — Testes e métricas de comissões _(depende: NEX-263,NEX-265,NEX-266)_

### EPIC-25 — CRM, segmentação e campanhas manuais

- [ ] **NEX-270** — Motor de segmentos _(depende: NEX-090)_
- [ ] **NEX-271** — Segmentos guardados _(depende: NEX-270)_
- [ ] **NEX-272** — UI Clientes — Segmentos _(depende: NEX-271)_
- [ ] **NEX-273** — Campanha manual _(depende: NEX-271)_
- [ ] **NEX-274** — UI do construtor de campanhas _(depende: NEX-273)_
- [ ] **NEX-275** — Aniversários _(depende: NEX-270)_
- [ ] **NEX-276** — Reativação _(depende: NEX-270)_
- [ ] **NEX-277** — Consentimento de marketing _(depende: NEX-270)_
- [ ] **NEX-278** — Segurança e privacidade do CRM _(depende: NEX-273,NEX-277)_
- [ ] **NEX-279** — Testes e métricas de CRM _(depende: NEX-272,NEX-274,NEX-277)_

### EPIC-26 — Fichas técnicas, anamnese e consentimentos

- [ ] **NEX-280** — Modelos de ficha _(depende: NEX-013)_
- [ ] **NEX-281** — Versão de modelo _(depende: NEX-280)_
- [ ] **NEX-282** — Ficha da cliente — novas tabs _(depende: NEX-091,NEX-281)_
- [ ] **NEX-283** — Preenchimento de ficha _(depende: NEX-282)_
- [ ] **NEX-284** — Proteção adicional para fichas sensíveis _(depende: NEX-282)_
- [ ] **NEX-285** — Consentimentos _(depende: NEX-280)_
- [ ] **NEX-286** — UI Definições — Fichas e consentimentos _(depende: NEX-140,NEX-281,NEX-285)_
- [ ] **NEX-287** — Exportação e eliminação de fichas _(depende: NEX-162,NEX-163,NEX-283)_
- [ ] **NEX-288** — Avisos legais de fichas _(depende: NEX-286)_
- [ ] **NEX-289** — Testes e métricas de fichas/consentimentos _(depende: NEX-283,NEX-284,NEX-285,NEX-287)_

### EPIC-27 — Multi-localização

- [ ] **NEX-290** — Modelo de localizações _(depende: NEX-011)_
- [ ] **NEX-291** — Escopo por localização _(depende: NEX-290)_
- [ ] **NEX-292** — Horários e serviços por localização _(depende: NEX-060,NEX-291)_
- [ ] **NEX-293** — Seletor global de localização _(depende: NEX-291)_
- [ ] **NEX-294** — Página de localizações _(depende: NEX-291)_
- [ ] **NEX-295** — Marcação pública por localização _(depende: NEX-050,NEX-291)_
- [ ] **NEX-296** — Relatórios consolidados por localização _(depende: NEX-130,NEX-291)_
- [ ] **NEX-297** — Transferências entre localizações _(depende: NEX-291)_
- [ ] **NEX-298** — Segurança multi-localização _(depende: NEX-211,NEX-291)_
- [ ] **NEX-299** — Testes e métricas multi-localização _(depende: NEX-293,NEX-295,NEX-298)_

### EPIC-28 — Relatórios avançados

- [ ] **NEX-300** — Hub de relatórios _(depende: NEX-130)_
- [ ] **NEX-301** — Ocupação da agenda _(depende: NEX-082,NEX-300)_
- [ ] **NEX-302** — Clientes e retenção _(depende: NEX-090,NEX-300)_
- [ ] **NEX-303** — Serviços (relatório) _(depende: NEX-300)_
- [ ] **NEX-304** — Prestadores (relatório) _(depende: NEX-216,NEX-300)_
- [ ] **NEX-305** — Packs (relatório) _(depende: NEX-231,NEX-300)_
- [ ] **NEX-306** — Stock (relatório) _(depende: NEX-251,NEX-300)_
- [ ] **NEX-307** — UI de gráficos sem biblioteca externa _(depende: NEX-301)_
- [ ] **NEX-308** — Exportação de relatórios _(depende: NEX-132,NEX-133,NEX-134,NEX-301)_
- [ ] **NEX-309** — Testes e métricas de relatórios _(depende: NEX-307,NEX-308)_

### EPIC-29 — Notificações sem API paga

- [ ] **NEX-310** — Modelo de notificações internas _(depende: NEX-013)_
- [ ] **NEX-311** — Página Notificações _(depende: NEX-310)_
- [ ] **NEX-312** — Web Push para a dona _(depende: NEX-310)_
- [ ] **NEX-313** — Push para cliente, opcional _(depende: NEX-220,NEX-312)_
- [ ] **NEX-314** — Preferências de notificação _(depende: NEX-311,NEX-312)_
- [ ] **NEX-315** — Badge da app _(depende: NEX-311)_
- [ ] **NEX-316** — Cron e jobs de notificações _(depende: NEX-310)_
- [ ] **NEX-317** — Privacidade das notificações _(depende: NEX-311,NEX-313)_
- [ ] **NEX-318** — Testes e métricas de notificações _(depende: NEX-312,NEX-313,NEX-317)_

### EPIC-30 — Centro de ajuda e feedback

- [ ] **NEX-320** — Ajuda baseada em Markdown _(depende: Nenhuma)_
- [ ] **NEX-321** — Página Ajuda _(depende: NEX-320)_
- [ ] **NEX-322** — Ajuda contextual _(depende: NEX-144,NEX-321)_
- [ ] **NEX-323** — Feedback interno _(depende: Nenhuma)_
- [ ] **NEX-324** — Estado do pedido de feedback _(depende: NEX-323)_
- [ ] **NEX-325** — UI em Mais — Suporte _(depende: NEX-321,NEX-323)_

### EPIC-31 — Planos, limites e administração manual

- [ ] **NEX-330** — Modelo de planos _(depende: NEX-013)_
- [ ] **NEX-331** — Entitlements _(depende: NEX-330)_
- [ ] **NEX-332** — Enforcement server-side de limites _(depende: NEX-331)_
- [ ] **NEX-333** — UI Definições — Plano _(depende: NEX-140,NEX-331)_
- [ ] **NEX-334** — Avisos de limite _(depende: NEX-332,NEX-333)_
- [ ] **NEX-335** — Admin mínimo _(depende: NEX-330)_
- [ ] **NEX-336** — Período de teste manual _(depende: NEX-330)_
- [ ] **NEX-337** — UI de trial _(depende: NEX-336)_
- [ ] **NEX-338** — Migração de tenants existentes para plano _(depende: NEX-330)_
- [ ] **NEX-339** — Testes de planos e limites _(depende: NEX-332,NEX-334,NEX-338)_

### EPIC-32 — Landing, preçário e demonstração

- [ ] **NEX-340** — Estrutura de domínio _(depende: Nenhuma)_
- [ ] **NEX-341** — Landing principal _(depende: NEX-340)_
- [ ] **NEX-342** — Página de funcionalidades _(depende: NEX-341)_
- [ ] **NEX-343** — Preçário verdadeiro _(depende: NEX-330,NEX-341)_
- [ ] **NEX-344** — Demonstração sem automação paga _(depende: NEX-341)_
- [ ] **NEX-345** — UI da landing _(depende: NEX-341)_
- [ ] **NEX-346** — SEO e metadata _(depende: NEX-341)_
- [ ] **NEX-347** — Privacidade e termos _(depende: NEX-341)_
- [ ] **NEX-348** — Analytics sem fornecedor pago _(depende: NEX-341)_
- [ ] **NEX-349** — Testes da landing _(depende: NEX-345,NEX-346,NEX-347)_

## Regras de atualização

- Não reordenar IDs após início da execução.
- Bloqueios devem indicar motivo, owner e condição de desbloqueio.
- Novas tarefas exigem ID, dependências, aceite, testes e impacto de segurança.
