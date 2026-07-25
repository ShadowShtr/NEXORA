# Data map e subprocessadores (NEX-160)

Este documento cobre o que `docs/05_SECURITY_PRIVACY.md` #Subprocessadores pedia para
manter antes de produção: fluxos, regiões, DPA e owners. Como o resto de
`05_SECURITY_PRIVACY.md`, transforma princípios de RGPD em documentação técnica — não
é uma declaração de conformidade formal nem substitui aconselhamento jurídico.

## Fluxos de dados pessoais

1. **Marcação pública** (`/b/[slug]` → `/marcacao/[token]`): a cliente introduz
   nome, telemóvel e, opcionalmente, e-mail e observações. Passa primeiro por
   `booking_drafts` (cifrado com AES-256-GCM, TTL de 24h, `NEX-052`), depois por
   `create_public_booking` (RPC `security definer`) para `clients`/`appointments` no
   Postgres do Supabase. O pedido em si (incluindo o IP de origem) passa pelas funções
   serverless da Vercel antes de chegar ao Supabase.
2. **Rate limit / bot protection**: o IP de quem faz o pedido é usado como chave em
   `src/lib/rate-limit.ts` (Upstash Redis) e, no passo de resumo do booking, pelo
   Cloudflare Turnstile. Nenhum dos dois recebe nome/telemóvel/e-mail da cliente — só
   metadados técnicos do pedido.
3. **Lembrete por WhatsApp** (`NEX-100`-`103`): gerado como deep link `wa.me`, aberto
   manualmente pela dona no seu próprio WhatsApp — a app nunca envia a mensagem nem
   passa o número por um subprocessador de mensagens.
4. **E-mail de confirmação** (opcional, `NEX-074`): quando a cliente fornece e-mail e
   as variáveis do Resend estiverem configuradas, `src/lib/email/index.ts` envia a
   confirmação via Resend. Sem essas variáveis, o envio é no-op (a marcação nunca
   depende da entrega).
5. **Sessão da dona**: login Supabase Auth (e-mail/palavra-passe), sessão mantida por
   cookie `httpOnly`/`Secure`. Toda leitura/escrita autenticada passa pelas funções
   serverless da Vercel e pelo Postgres/Auth do Supabase.
6. **Fotografias de clientes/negócio**: upload → reencodado para JPEG (remove EXIF,
   incluindo geolocalização) → Supabase Storage, bucket privado (`client-photos`) ou
   público (`business-logos`/`business-covers`, sem PII de cliente).
7. **Código/CI**: GitHub aloja o repositório e corre CI (lint/test/build/CodeQL/
   Gitleaks) — nunca com dados reais (`docs/ENVIRONMENTS_AND_SECRETS.md`: local e
   preview usam dados sintéticos/seed).

## Subprocessadores

| Subprocessador                    | Papel                                        | Região                                                                                                                            | Dados envolvidos                                                                 | Estado                                                                                        |
| --------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Supabase**                      | Base de dados (Postgres), Auth, Storage      | UE (Frankfurt/Irlanda ou similar — confirmado como UE pela dona; cidade exata a confirmar no dashboard antes de produção pública) | Todos os dados de clientes/marcações/pagamentos/fotografias                      | Ativo — projeto de produção isolado do de dev/preview (`ENVIRONMENTS_AND_SECRETS.md`)         |
| **Vercel**                        | Hospedagem, funções serverless, build/deploy | **EUA (`iad1`, Washington D.C.)** — confirmado via `vercel inspect` nesta tarefa, sem `vercel.json` a fixar outra região          | Todo o tráfego HTTP passa por aqui em trânsito (não é armazenamento persistente) | Ativo                                                                                         |
| **GitHub**                        | Repositório de código, CI/CD                 | N/A (sem dados de produção)                                                                                                       | Nenhum dado real de cliente (`ENVIRONMENTS_AND_SECRETS.md`)                      | Ativo                                                                                         |
| **Resend**                        | Envio de e-mail de confirmação (opcional)    | A confirmar (conta ainda não provisionada)                                                                                        | Nome, e-mail, detalhes da marcação — só se a cliente der e-mail                  | **Schema pronto, sem conta real** — integração degrada para no-op sem credenciais             |
| **Upstash Redis**                 | Rate limiting distribuído                    | A confirmar (conta ainda não provisionada)                                                                                        | IP + identificador de tenant/endpoint (sem PII de cliente)                       | **Schema pronto, sem conta real** — código degrada para "sem limite" sem credenciais          |
| **Cloudflare Turnstile**          | Proteção anti-bot no formulário público      | A confirmar (conta ainda não provisionada)                                                                                        | Sinais técnicos do browser/pedido (sem PII de cliente)                           | **Schema pronto, sem conta real** — sem esta variável, todo o visitante é tratado como humano |
| **Ferramenta de observabilidade** | Erros/telemetria (`NEX-170`, futura)         | N/A                                                                                                                               | A definir quando implementada                                                    | **Planeada, não implementada**                                                                |

## Regiões e transferências internacionais

O achado mais relevante desta tarefa: a base de dados (Supabase) está na UE, mas as
**funções serverless da Vercel que processam cada pedido correm em `iad1` (EUA-Este)**,
sem região fixada em `vercel.json`. Isto significa que dados pessoais de clientes
PT/UE são processados (não só armazenados) em infraestrutura sediada nos EUA a cada
pedido — uma transferência internacional relevante para efeitos de RGPD, cuja
adequação/salvaguardas (SCCs, avaliação de impacto, etc.) não foram avaliadas
juridicamente nesta tarefa. Registado como risco residual, ver abaixo — não corrigido
aqui (fixar a região da Vercel é uma decisão de infraestrutura/custo que a dona deve
tomar conscientemente, não algo para mudar silenciosamente numa tarefa de
documentação).

Resend/Upstash/Turnstile ainda não têm conta real provisionada — a região desses três
só pode ser confirmada quando forem contratados (tipicamente escolhida no momento da
criação da conta).

## DPA (Data Processing Agreements)

Nenhum DPA foi negociado ou assinado individualmente — não é isso que este projeto,
na fase atual (profissional independente, solo), normalmente faz. Os quatro
subprocessadores ativos/planeados (Supabase, Vercel, GitHub, e futuramente Resend/
Upstash/Turnstile quando provisionados) oferecem DPAs padrão aceites como parte dos
seus próprios termos de serviço — aceitar esses termos (ou assinar o DPA padrão de
cada um, quando o plano contratado o exigir) é uma ação que só a dona/owner da conta
pode tomar em cada dashboard, não algo que este documento ou o código possam
substituir. Confirmar isto antes de produção com dados reais em maior escala é o
mesmo "antes de produção" já pedido em `05_SECURITY_PRIVACY.md`.

## Owners

Nesta fase (projeto solo), o owner único de todos os dados e de todas as contas de
subprocessador é a mesma pessoa: **ShadowShtr** (GitHub) / a dona (Supabase, Vercel,
e futuramente Resend/Upstash/Turnstile) — mesmo owner de segredos já documentado em
`docs/ENVIRONMENTS_AND_SECRETS.md`. Quando a NEXORA passar a ter equipa, este
documento e o de ambientes/segredos devem ganhar um RACI explícito antes de conceder
acesso a mais pessoas — não antecipado agora (fora de escopo da primeira vertical,
`CLAUDE.md`).

## Revisão privacy (teste obrigatório desta tarefa)

- Confirmado que nenhum subprocessador recebe mais dados do que o necessário para o
  seu papel (rate limit/Turnstile só veem metadados técnicos, nunca PII de cliente).
- Confirmado que os três subprocessadores "schema pronto" (Resend, Upstash, Turnstile)
  não recebem tráfego real enquanto não forem provisionados — a app degrada
  graciosamente na ausência das suas credenciais (já testado/documentado nas tarefas
  que os introduziram, `NEX-066`/`NEX-074`).
- Confirmado, pela primeira vez nesta tarefa, que a região de execução da Vercel
  (EUA) diverge da região de armazenamento do Supabase (UE) — não estava documentado
  antes; ver "Regiões e transferências internacionais" acima.
- Não validado: adequação jurídica da transferência EUA/UE, prazos de retenção
  "a validar" já sinalizados em `docs/04_DATA_MODEL.md`. Ambos exigem profissional
  jurídico competente, como já declarado em `05_SECURITY_PRIVACY.md`.

## Riscos residuais

- Transferência internacional UE→EUA via região da Vercel, não avaliada juridicamente
  (ver acima) — o risco tecnicamente mais significativo encontrado nesta tarefa.
- Região exata do Supabase (cidade) não confirmada por mim diretamente (sem acesso ao
  dashboard nesta sessão) — só a confirmação da dona de que é UE.
- Regiões de Resend/Upstash/Turnstile por confirmar quando forem provisionados.
- Nenhum DPA individual assinado — depende de ação da dona em cada dashboard, fora do
  alcance do código/documentação.

## Próxima tarefa desbloqueada

NEX-161 — Retenção e limpeza de drafts (depende de NEX-052, já concluída).
