# NEX-094 — Fotografias privadas

## Implementação

- `supabase/migrations/0019_client_photos_storage.sql` (novo): bucket privado `client-photos` (`public=false`, `file_size_limit=8388608`, `allowed_mime_types=['image/jpeg']`) — a tabela `client_photos` e a sua RLS tenant-scoped já existiam desde `0001_initial.sql`/`0002_harden_tenant_fk_integrity.sql`, só faltava o Storage por trás de `storage_path`. Convenção de caminho `{tenant_id}/{client_id}/{photo_id}.jpg`; três policies (`select`/`insert`/`delete`, `to authenticated`) comparam o primeiro segmento do caminho (`storage.foldername(name)[1]`) com `public.current_tenant_id()`. Sem policy `update` (substituir é apagar + reenviar) nem `anon` (nunca há portefólio público, `docs/01_PRODUCT_REQUIREMENTS.md` §10).
- `src/features/clients/domain/photos.ts` (novo): `CLIENT_PHOTO_KINDS` (`before`/`after`/`other`, espelha o check constraint), allowlist de MIME de entrada (`jpeg`/`png`/`webp`) e limite de 8 MB — validação pura, testável.
- `src/lib/image-processing.ts` (novo): `reencodePhotoAsJpeg` via `sharp` — `rotate()` (aplica a orientação EXIF antes de a remover, para a foto não ficar de lado), `resize` (máx. 2000px, sem upscale), `.jpeg({quality:85})`. `sharp.jpeg()` nunca leva metadata a menos que `.withMetadata()` seja chamado — o EXIF (incluindo GPS) é omitido, não limpo a posteriori. Isto duplica como "verificação por assinatura" (`docs/05_SECURITY_PRIVACY.md`, Uploads): `sharp` só produz saída para bytes que decodificam mesmo como imagem, ao contrário de confiar só no `Content-Type` declarado pelo browser.
- `src/features/clients/photo-actions.ts` (novo): `uploadClientPhoto` (valida tamanho/MIME antes de ler bytes, reencoda, gera `storagePath` a partir do `tenantId` da sessão — nunca do formulário —, faz upload e insere a linha `client_photos`; um `clientId` de outro tenant falha na FK composta `client_photos_tenant_client_fkey`, 23503, apanhado e devolvido como `NOT_FOUND`; falha no insert limpa o objeto já enviado) e `deleteClientPhoto` (delete-and-return numa chamada só, devolve `storage_path` para remoção best-effort do Storage — RLS é a fronteira de autorização real, igual a todas as outras mutações tenant-scoped deste código).
- `src/features/clients/ClientPhotosForm.tsx` (novo): formulário de upload (ficheiro + tipo) e galeria de miniaturas com apagar por foto; usa o padrão de "remount por key" já usado em `PackagesManager` para limpar o `<input type="file">` depois de um upload com sucesso.
- `src/app/(dashboard)/dashboard/clientes/[id]/page.tsx`: nova query `client_photos` + `createSignedUrls` (TTL de 300s, `docs/05_SECURITY_PRIVACY.md` "Signed URLs de curta duração") em paralelo com a query de `appointments`; novo cartão "Fotografias" entre "Observações privadas" e "Histórico".
- `src/app/globals.css`: `.client-photo-list`/`.client-photo-item`/`.client-photo-thumb` (grelha responsiva de miniaturas quadradas).
- Sem escrita em `audit_logs`: os critérios de aceite da tarefa não pedem auditoria (ao contrário de `NEX-093`), e não expandir o escopo é uma instrução explícita do próprio ficheiro do épico.

## Testes

- `tests/unit/client-photos.test.ts` (novo, 9/9 ✅): allowlist de MIME (aceita jpeg/png/webp, rejeita SVG/executável/vazio), limite de tamanho (0/negativo/acima do limite rejeitados), `kind` válido/inválido.
- `tests/unit/image-processing.test.ts` (novo, 4/4 ✅): EXIF (incluindo GPS) removido do output; redimensiona para 2000px máx. mantendo proporção; nunca faz upscale; rejeita bytes que não decodificam como imagem real.
- `tests/integration/client-photos-storage-rls.test.ts` (novo, 7/7 ✅, gated pelas mesmas env vars de `rls-tenant-isolation.test.ts` — **corrido de verdade contra o Supabase de dev nesta sessão**, não só compilado): dona consegue enviar para a sua própria pasta de tenant; outra dona não consegue enviar para a pasta alheia (RLS de storage insert); dona consegue reler o que enviou; outra dona não consegue descarregar, listar (`list()` devolve vazio, não erro — RLS filtra como um `select`, não bloqueia a chamada) nem gerar signed URL do objeto alheio; apagar como outra dona é um no-op silencioso (o objeto continua acessível pela dona original); insert de `client_photos` cruzando tenant é rejeitado por RLS (`42501`); insert com `client_id` de outro tenant dentro do próprio `tenant_id` é rejeitado pela FK composta (`23503`); leitura da própria linha funciona, leitura pela outra dona devolve vazio.
- **Fluxo real testado no browser** (Playwright contra o dev server local + Supabase de dev, utilizador provisionado e depois removido): upload de uma foto com EXIF sintético (GPS + Copyright) → aparece na galeria (miniatura confirmada a carregar de verdade, `naturalWidth=800`, não só presente no DOM) → objeto no Storage confirmado sem EXIF (`STORED_HAS_EXIF=false`, `STORED_FORMAT=jpeg`) → apagar remove da galeria (`THUMB_COUNT_AFTER_DELETE=0`).
- `npm run verify` — ✅ (format, lint, typecheck, 285 testes unitários — 13 novos —, build).

## Resultado

Cobre os quatro critérios de aceite: upload seguro (allowlist de MIME + tamanho + reencode/verificação por assinatura via `sharp`), signed URL (TTL curto, geradas só no load da página, nunca persistidas), exclusão (delete-and-return + remoção do Storage), e nenhum dado de outro tenant acedido (RLS de storage + RLS/FK de `client_photos`, confirmado por teste de integração real). Interface simples: um cartão, um formulário, uma galeria — sem fluxo adicional.

## Riscos residuais

- Falha ao remover o objeto do Storage depois de a linha `client_photos` já ter sido apagada (best-effort, erro ignorado) deixa um blob órfão mas ainda tenant-scoped — nunca alcançável por outro tenant nem pela UI (sem linha, sem signed URL gerável). Aceitável; limpeza de órfãos fica fora de escopo desta tarefa.
- Hardening adicional de upload (ex. scanning mais profundo, rate limit dedicado ao upload) é explicitamente `NEX-165`, que já depende de `NEX-094`.

## Próxima tarefa desbloqueada

`NEX-114` — Área de pagamentos pendentes (depende de `NEX-113`, já concluída) ou `NEX-115` — Reabrir/corrigir com auditoria (mesma dependência). Com `NEX-094` concluída, o `EPIC-09` fica 100% completo.
