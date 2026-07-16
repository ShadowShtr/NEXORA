# 05 — Cybersecurity e privacidade

## Escopo

A aplicação trata dados pessoais de clientes em Portugal/UE. A aplicabilidade jurídica final e bases legais devem ser validadas por profissional competente. Este documento transforma princípios de RGPD e privacy by design em controlos técnicos, sem declarar conformidade formal.

## Ativos

- credenciais da dona;
- dados de contacto das clientes;
- agenda e disponibilidade;
- observações e fotografias;
- registos financeiros internos;
- tokens de links públicos;
- chaves Supabase/Vercel/e-mail;
- logs e backups.

## Ameaças principais

| ID  | Ameaça                         | Impacto                | Controlo principal                                 |
| --- | ------------------------------ | ---------------------- | -------------------------------------------------- |
| T1  | Acesso entre tenants           | violação de dados      | RLS + tenant derivado da sessão + testes negativos |
| T2  | Dupla reserva concorrente      | perda operacional      | constraint GiST + transação                        |
| T3  | Enumeração de links            | exposição de marcações | token aleatório 256-bit, hash em DB, rate limit    |
| T4  | Abuso de marcação pública      | spam/DoS               | rate limit distribuído, bot protection em produção |
| T5  | Sequestro de sessão            | acesso à agenda        | cookies seguros, validação server-side, revogação  |
| T6  | Service role exposta           | comprometimento total  | segredo somente server, scans, env separation      |
| T7  | Upload malicioso               | malware/exposição      | tipo/tamanho, bucket privado, nomes aleatórios     |
| T8  | Logs com PII                   | vazamento secundário   | redaction, allowlist de campos                     |
| T9  | Alteração financeira sem rasto | fraude/erro            | audit log append-only                              |
| T10 | Supply chain                   | execução de código     | lockfile, Dependabot, CodeQL, review, pin actions  |

## Autenticação

- Supabase e-mail/palavra-passe.
- Conta criada pelo administrador.
- Recuperação por e-mail.
- Verificar claims no servidor para páginas privadas.
- Rate limit em login e reset.
- Política de palavra-passe configurada no Supabase.
- MFA fica no backlog para contas privilegiadas e escala SaaS.

## Autorização

- RLS em todas as tabelas privadas.
- Policies baseadas em `auth.uid()` → profile → tenant.
- Nenhuma policy de cliente anónimo para appointments/clients/payments.
- Operações públicas passam por endpoint/RPC com dados mínimos.
- Service role é usada apenas em funções server-side estritamente limitadas.

## Links públicos

- Token gerado por CSPRNG.
- Armazenar `sha256(token)`.
- Comparar hash no servidor.
- Não incluir nome/telemóvel na URL.
- Permitir revogar/regenerar.
- Não expor link completo em logs.

## Uploads

- Bucket privado.
- Signed URLs de curta duração.
- Limite de tamanho configurado.
- Allowlist de MIME e verificação por assinatura quando possível.
- Remover EXIF no processamento ou impedir preservação de geolocalização.
- Sem SVG ou executáveis.

## Segurança HTTP

- HTTPS obrigatório.
- HSTS em produção.
- CSP com nonce e allowlist mínima.
- `frame-ancestors 'none'`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` restritiva.
- Cookies `Secure`, `HttpOnly`, `SameSite=Lax` ou mais restritivo.

## Rate limiting e bot protection

Não usar mapa em memória no serverless. Antes de produção:

- implementar rate limit distribuído por IP + tenant + endpoint;
- aplicar limites mais fortes em reserva, recuperação e login;
- considerar Turnstile após limiar de risco;
- manter fallback acessível.

## Privacidade

### Minimização

Obrigatórios no booking: nome e telemóvel. E-mail é opcional. Campos de preferência/fotografia são preenchidos pela dona quando necessários.

### Finalidades a validar

- executar e gerir marcações;
- comunicar confirmação/lembrete;
- manter histórico de atendimento;
- controlo financeiro interno;
- segurança e auditoria.

Marketing não faz parte do MVP e exige tratamento separado.

### Direitos

Backlog inclui:

- localizar dados por cliente;
- exportar dados estruturados;
- corrigir dados pela dona;
- apagar/anonimizar conforme obrigação aplicável;
- registar pedido e decisão.

### Subprocessadores

- Vercel;
- Supabase;
- fornecedor de e-mail;
- GitHub para código/CI, sem dados de produção;
- ferramenta de observabilidade, se ativada.

Manter lista, regiões, DPA e transferências internacionais documentadas antes de produção.

## Incidentes

- Severidade e owner definidos em `docs/08_OPERATIONS.md`.
- Preservar timeline e evidências.
- Avaliar impacto em titulares e países.
- Não assumir prazo regulatório sem validação jurídica atual.

## Testes de segurança

- RLS positivo e negativo.
- IDOR/BOLA em todas as rotas por ID.
- brute force/rate limit.
- token enumeration.
- upload adversarial.
- concorrência de slots.
- secret scanning.
- SAST/SCA/CodeQL.
- pentest proporcional antes de produção pública.
