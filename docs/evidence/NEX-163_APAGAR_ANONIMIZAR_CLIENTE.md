# NEX-163 — Apagar/anonimizar cliente

## Implementação

- **A restrição já existente decidiu o desenho**: `appointments.client_id` é `on
delete restrict` (`0001_initial.sql`) — uma cliente com marcações não pode ser
  apagada de facto sem quebrar o registo financeiro/auditoria dessas marcações. Em vez
  de tratar isso como um erro de base de dados a evitar, `supabase/migrations/0036`
  torna-o a própria decisão de produto: **sem histórico → apaga a sério; com histórico
  → anonimiza no lugar** (nome, telefone, e-mail, observações privadas e preferências
  limpos; marcações e pagamentos mantidos intactos).
- **`clients.anonymized_at`** (coluna nova, `timestamptz`) marca quando uma cliente foi
  anonimizada — permite à UI/futuras consultas distinguir uma cliente anonimizada de
  uma cliente normal sem inferir isso do nome literal "Cliente removida".
- **RPC `delete_or_anonymize_client(p_client_id)`** (`security definer`, só
  `authenticated`, nunca `service_role` nem `anon` — mesmo padrão da maioria das RPCs
  de negócio deste schema, ao contrário de `provision_tenant_owner`): decide
  apagar/anonimizar, remove sempre as linhas de `client_photos`, limpa
  `appointments.client_observation` (texto que a própria cliente escreveu ao reservar
  — dado pessoal dela, distinto de `appointment_items.description`, que descreve o
  serviço e fica intacto), escreve `audit_logs` (`client.deleted`/`client.anonymized`),
  e devolve os `storage_path`s que já não têm linha correspondente.
- **`src/features/clients/delete-actions.ts`** (nova Server Action) — chama a RPC e,
  com os caminhos devolvidos, remove os ficheiros reais do Storage
  (`supabase.storage.from('client-photos').remove(...)`) — trabalho que só o lado
  aplicação consegue fazer, uma função SQL não chega à API de Storage.
- **UI**: `ClientDeleteSection.tsx` (novo), mesmo padrão de confirmação em dois passos
  de toda a app (`NEX-084`/`115`/`123`/`143`) — o texto de confirmação já diz à dona
  qual das duas coisas vai acontecer (apagar tudo vs. só remover dados pessoais),
  calculado a partir de `allAppointments.length` já carregado pela própria página.

## Testes

- `tests/integration/delete-or-anonymize-client.test.ts` (novo, 4 casos) — cobre o
  teste obrigatório desta tarefa ("Referential/restore considerations"): `anon` sem
  permissão (`42501`); cliente sem histórico é apagada a sério (incluindo
  `client_photos`); cliente com histórico fica anonimizada mas a marcação mantém
  `expected_total_cents`/`client_id` intactos (o "restore consideration" — nada do
  registo financeiro se perde); e a dona B não consegue apagar/anonimizar uma cliente
  da dona A (`22023`), com as duas sessões reais autenticadas (não `service_role` —
  ao contrário de outras RPCs deste projeto, esta só está concedida a `authenticated`,
  por isso o teste tinha de usar sessões reais para ser válido).
- **Não foi possível correr localmente** — sem Docker/WSL2 (`ADR-007`); verificado só
  via CI (`integration`).
- `npm run verify` (format, lint, typecheck, 446 testes, build, budget) — ✅.

## Resultado

A dona tem agora um único fluxo para "apagar uma cliente" que faz a coisa certa
automaticamente consoante exista ou não histórico associado — nunca expõe um erro de
base de dados, nunca arrisca perder um registo financeiro.

## Riscos residuais

- Telefone anonimizado (`+999` + 9 dígitos derivados de `hashtext(client_id)`) pode
  colidir com outro já anonimizado na mesma tenant — probabilidade astronómica; se
  acontecer, a operação falha com violação de unicidade em vez de corromper dados.
- Fotografias no Storage são removidas em melhor esforço (mesma lógica de
  `deleteClientPhoto`, `NEX-094`) — se a chamada ao Storage falhar depois da RPC já ter
  removido as linhas de `client_photos`, fica um ficheiro órfão (sem PII associável,
  já sem linha na base de dados a apontar para ele).

## Próxima tarefa desbloqueada

NEX-164 — Headers/CSP completos (depende de NEX-023, já concluída).
