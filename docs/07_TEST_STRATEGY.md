# 07 — Estratégia de testes

## Pirâmide

### Unitários — Vitest

- cálculo de duração e preço;
- geração de slots;
- intervalos e buffers;
- cancelamento e estados;
- recorrências;
- descontos fixos/percentuais;
- normalização de telefone;
- timezone e DST.

### Integração

- migrations e constraints;
- RLS por tenant;
- RPC de booking;
- transações financeiras;
- idempotência;
- storage policies.

### E2E — Playwright

Fluxos críticos:

1. dona entra e conclui onboarding;
2. cria serviço e publica agenda;
3. cliente marca sem e-mail;
4. cliente marca com e-mail;
5. segunda cliente não vê slot ocupado;
6. concorrência: uma reserva ganha e outra recebe conflito;
7. dona abre WhatsApp e marca lembrete como enviado;
8. dona conclui pagamento dinheiro;
9. dona conclui MB WAY;
10. dona conclui pendente e regulariza depois;
11. exporta relatório;
12. cria recorrência e resolve conflito.

## Segurança

- cada tabela privada testada com tenant A e tenant B;
- anon não lê PII;
- token inválido não diferencia inexistente/revogado;
- service role não aparece em bundle;
- CSP e headers verificados;
- links e logs sem PII indevida.

## Acessibilidade

- axe em páginas principais;
- navegação por teclado;
- foco em modais;
- contraste;
- mensagens de erro anunciadas.

## Performance

- catálogo p95;
- disponibilidade com agenda carregada;
- criação de booking sob concorrência;
- exportação de período máximo permitido.

## Recuperação

- migration up testada;
- estratégia roll-forward documentada;
- restore Supabase testado antes de produção;
- export de tenant validado.

## Gates

PR não pode ser aceite com:

- types/lint/build falhando;
- teste crítico falhando;
- vulnerabilidade crítica/alta sem decisão formal;
- migration sem teste;
- nova tabela privada sem RLS;
- alteração de auth/financeiro sem testes negativos.
