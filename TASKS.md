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
- [ ] **NEX-015** — Criar testes automatizados de isolamento _(depende: NEX-012)_

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

- [ ] **NEX-050** — Criar página pública por slug _(depende: NEX-035)_
- [ ] **NEX-051** — Criar pré-cadastro temporário _(depende: NEX-050)_
- [ ] **NEX-052** — Implementar draft e recuperação _(depende: NEX-051)_
- [ ] **NEX-053** — Criar seletor Serviços/Pacotes _(depende: NEX-043,NEX-050)_
- [ ] **NEX-054** — Criar carrinho fixo _(depende: NEX-053)_

### EPIC-06 — Motor de disponibilidade

- [ ] **NEX-060** — Modelar horários e exceções _(depende: NEX-011,NEX-032)_
- [ ] **NEX-061** — Implementar gerador de slots timezone-aware _(depende: NEX-060)_
- [ ] **NEX-062** — Implementar consulta pública de disponibilidade _(depende: NEX-061,NEX-054)_
- [ ] **NEX-063** — Implementar constraint de não sobreposição _(depende: NEX-011)_
- [ ] **NEX-064** — Implementar booking transacional/idempotente _(depende: NEX-063,NEX-051)_
- [ ] **NEX-065** — Tratar SLOT_TAKEN na UX _(depende: NEX-064)_
- [ ] **NEX-066** — Rate limit e bot protection _(depende: NEX-064)_

### EPIC-07 — Confirmação e link da marcação

- [ ] **NEX-070** — Criar ecrã final de confirmação _(depende: NEX-064)_
- [ ] **NEX-071** — Criar link público seguro _(depende: NEX-064)_
- [ ] **NEX-072** — Gerar ficheiro ICS _(depende: NEX-071)_
- [ ] **NEX-073** — Implementar abrir localização _(depende: NEX-071)_
- [ ] **NEX-074** — Implementar e-mail opcional _(depende: NEX-071)_

### EPIC-08 — Dashboard e agenda da dona

- [ ] **NEX-080** — Dashboard combinado _(depende: NEX-023,NEX-064)_
- [ ] **NEX-081** — Cartões de marcação _(depende: NEX-080)_
- [ ] **NEX-082** — Visualizações dia/semana/mês _(depende: NEX-080)_
- [ ] **NEX-083** — Resumo/lista de horários livres _(depende: NEX-061,NEX-080)_
- [ ] **NEX-084** — Detalhes, cancelar e reagendar _(depende: NEX-081)_
- [ ] **NEX-085** — Marcação manual completa _(depende: NEX-041,NEX-061,NEX-080)_

### EPIC-09 — Clientes e histórico

- [ ] **NEX-090** — Lista e pesquisa de clientes _(depende: NEX-064,NEX-023)_
- [ ] **NEX-091** — Ficha completa da cliente _(depende: NEX-090)_
- [ ] **NEX-092** — Sugestão/deduplicação no booking manual _(depende: NEX-090,NEX-085)_
- [ ] **NEX-093** — Observações privadas _(depende: NEX-091)_
- [ ] **NEX-094** — Fotografias privadas _(depende: NEX-091)_
- [ ] **NEX-095** — Política configurável de faltas _(depende: NEX-091)_

### EPIC-10 — Lembretes e WhatsApp manual

- [ ] **NEX-100** — Gerar lembrete 24h _(depende: NEX-064)_
- [ ] **NEX-101** — Lista de lembretes pendentes _(depende: NEX-100,NEX-080)_
- [ ] **NEX-102** — Gerar deep link WhatsApp _(depende: NEX-101)_
- [ ] **NEX-103** — Registar aberto e marcado enviado _(depende: NEX-102)_
- [ ] **NEX-104** — Personalizar template simples _(depende: NEX-102)_

### EPIC-11 — Conclusão, pagamentos e pendências

- [ ] **NEX-110** — Modal de conclusão rápida _(depende: NEX-081)_
- [ ] **NEX-111** — Tela Ver mais e extras _(depende: NEX-110)_
- [ ] **NEX-112** — Descontos fixos/percentuais _(depende: NEX-111)_
- [ ] **NEX-113** — Transação de conclusão _(depende: NEX-110)_
- [ ] **NEX-114** — Área de pagamentos pendentes _(depende: NEX-113)_
- [ ] **NEX-115** — Reabrir/corrigir com auditoria _(depende: NEX-113)_

### EPIC-12 — Recorrência e disponibilidade avançada

- [ ] **NEX-120** — Gerador de recorrências _(depende: NEX-061,NEX-085)_
- [ ] **NEX-121** — Detetar conflitos e alternativas _(depende: NEX-120)_
- [ ] **NEX-122** — Criar série atomicamente _(depende: NEX-121)_
- [ ] **NEX-123** — Editar escopo da série _(depende: NEX-122)_
- [ ] **NEX-124** — Bloqueios completos _(depende: NEX-060,NEX-082)_
- [ ] **NEX-125** — Horários especiais _(depende: NEX-124)_

### EPIC-13 — Financeiro e relatórios

- [ ] **NEX-130** — Dashboard financeiro _(depende: NEX-113)_
- [ ] **NEX-131** — Filtros por período _(depende: NEX-130)_
- [ ] **NEX-132** — Exportar CSV _(depende: NEX-131)_
- [ ] **NEX-133** — Exportar Excel _(depende: NEX-131)_
- [ ] **NEX-134** — Exportar PDF _(depende: NEX-131)_
- [ ] **NEX-135** — Regras de retenção/exportação _(depende: NEX-132,NEX-133,NEX-134)_

### EPIC-14 — Definições e simplicidade operacional

- [ ] **NEX-140** — Central de definições em cartões _(depende: NEX-023,NEX-035)_
- [ ] **NEX-141** — Defaults e “usar recomendações” _(depende: NEX-140)_
- [ ] **NEX-142** — Pré-visualização da página pública _(depende: NEX-140)_
- [ ] **NEX-143** — Confirmações e desfazer _(depende: NEX-140)_
- [ ] **NEX-144** — Ajuda contextual curta _(depende: NEX-140)_

### EPIC-15 — PWA, design e acessibilidade

- [ ] **NEX-150** — Design system claymorphism _(depende: NEX-023)_
- [ ] **NEX-151** — Navegação mobile e desktop _(depende: NEX-150)_
- [ ] **NEX-152** — Manifest e instalação PWA _(depende: NEX-150)_
- [ ] **NEX-153** — Estratégia de cache segura _(depende: NEX-152)_
- [ ] **NEX-154** — Auditoria WCAG 2.2 AA _(depende: NEX-151)_
- [ ] **NEX-155** — Performance e Web Vitals _(depende: NEX-151)_

### EPIC-16 — Privacidade, segurança e direitos

- [ ] **NEX-160** — Data map e subprocessadores _(depende: NEX-004,NEX-011)_
- [ ] **NEX-161** — Retenção e limpeza de drafts _(depende: NEX-052)_
- [ ] **NEX-162** — Exportar dados da cliente _(depende: NEX-091)_
- [ ] **NEX-163** — Apagar/anonimizar cliente _(depende: NEX-091,NEX-094)_
- [ ] **NEX-164** — Headers/CSP completos _(depende: NEX-023)_
- [ ] **NEX-165** — Hardening uploads _(depende: NEX-094)_
- [ ] **NEX-166** — Threat model atualizado e security review _(depende: NEX-115,NEX-135,NEX-164)_
- [ ] **NEX-167** — Pentest proporcional _(depende: NEX-166)_

### EPIC-17 — Observabilidade, CI/CD e lançamento

- [ ] **NEX-170** — Logs estruturados e redaction _(depende: NEX-004)_
- [ ] **NEX-171** — Métricas e alertas _(depende: NEX-170)_
- [ ] **NEX-172** — Deploy Vercel e Supabase separados _(depende: NEX-003,NEX-010)_
- [ ] **NEX-173** — Backups e restore test _(depende: NEX-172)_
- [ ] **NEX-174** — Runbooks de incidentes _(depende: NEX-171,NEX-173)_
- [ ] **NEX-175** — Load/concurrency test _(depende: NEX-064,NEX-155)_
- [ ] **NEX-176** — Checklist beta privado _(depende: NEX-154,NEX-167,NEX-175)_
- [ ] **NEX-177** — Lançamento e monitorização inicial _(depende: NEX-176)_

## Regras de atualização

- Não reordenar IDs após início da execução.
- Bloqueios devem indicar motivo, owner e condição de desbloqueio.
- Novas tarefas exigem ID, dependências, aceite, testes e impacto de segurança.
