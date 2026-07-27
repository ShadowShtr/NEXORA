# NEX-165 — Hardening uploads

## Implementação

- **Investigação primeiro, código depois**: os três caminhos de upload de foto
  (`src/features/catalog/photo-actions.ts` — serviços, `src/features/settings/business-photo-actions.ts`
  — logo/capa, `src/features/clients/photo-actions.ts` — galeria de cliente) já
  partilham a mesma base sólida desde a `NEX-094` (`src/lib/image-processing.ts`):
  MIME allowlist + limite de tamanho antes de ler o ficheiro, reencode obrigatório
  para JPEG via `sharp` (remove EXIF por omissão, incluindo GPS, e só produz saída
  para bytes que decodificam de facto como imagem — a verificação por assinatura),
  e Storage privado com URLs assinadas. Catálogo e logo/capa já têm quota natural (um
  registo por serviço/campo, semântica de substituição); só `client_photos` é uma
  galeria sem limite de contagem. Os gaps reais eram dois, não a lista toda de
  "validação real, quotas, EXIF, signed URLs" do critério de aceite.
- **`MAX_INPUT_PIXELS` explícito** (`src/lib/image-processing.ts`, 100 megapixels) —
  passado a `sharp(input, { limitInputPixels: ... })`. O `sharp`/libvips já recusa
  decodificar acima de um default implícito (~268 MP), mas esse número nunca esteve
  escrito nem justificado neste código — um ficheiro pequeno e bem comprimido pode
  ainda assim descomprimir para uma grelha de pixels enorme (decompression bomb
  clássica: o tamanho em bytes não diz nada sobre o custo de descodificar). 100 MP
  fica bem abaixo do default da biblioteca e bem acima de qualquer foto real de
  telemóvel, tornando o limite uma decisão visível em vez de um comportamento
  assumido da dependência.
- **`MAX_PHOTOS_PER_CLIENT = 40`** (`src/features/clients/domain/photos.ts`) +
  `hasReachedPhotoQuota(count)` (função pura) — `uploadClientPhoto`
  (`src/features/clients/photo-actions.ts`) conta as linhas `client_photos` do
  `clientId` (sob RLS, logo já filtrado ao tenant da sessão) antes do reencode caro em
  `sharp`, e recusa com `VALIDATION_ERROR` ao atingir o limite. 40 cobre largamente o
  histórico de antes/depois realista de uma cliente, limitando o custo de
  Storage/renderização por cliente sem impor uma quota artificialmente apertada.

## Testes

- `tests/unit/image-processing.test.ts` (novo caso) — cobre o teste obrigatório
  desta tarefa ("ficheiros adversariais"): gera um JPEG sintético de cor sólida
  10500×10000 (105 MP, acima do limite de 100 MP) — pequeno e barato de gerar no
  teste, mas com a forma exata de uma decompression bomb (dimensões enormes,
  ficheiro pequeno) — e confirma que `reencodePhotoAsJpeg` rejeita.
- `tests/unit/client-photos.test.ts` (novo `describe`) — `hasReachedPhotoQuota`
  aceita abaixo do limite e bloqueia a partir de `MAX_PHOTOS_PER_CLIENT`, nos dois
  extremos (`-1`/limite/`+1`).
- `npm run verify` (format, lint, typecheck, 449 testes, build, budget) — ✅. Build
  confirma `.next/server/middleware-manifest.json` continua populado (regressão da
  `NEX-164` sempre verificada depois de qualquer build local).

## Resultado

Os dois gaps reais de hardening identificados na investigação — limite de pixels de
entrada não documentado e ausência de quota na galeria de fotos de cliente — estão
agora explícitos, testados e com o resto da validação (MIME, tamanho, EXIF,
assinatura, URLs assinadas) confirmado como já adequado desde a `NEX-094`, sem
reimplementar o que já funcionava.

## Riscos residuais

- A quota de `client_photos` é aplicada apenas na server action (contagem antes do
  insert), não por uma constraint na base de dados — uma escrita direta à tabela por
  fora desta função (ex.: um script administrativo futuro) não é bloqueada. Aceitável
  porque `client_photos` só é escrita por este único caminho hoje.
- `MAX_INPUT_PIXELS`/`MAX_PHOTOS_PER_CLIENT` são constantes fixas, não configuráveis
  por tenant — adequado para uma quota de proteção de custo/recurso, não uma decisão
  de produto por dona.

## Próxima tarefa desbloqueada

NEX-166 — Threat model atualizado e security review (depende de NEX-115, NEX-135,
NEX-164, já concluídas).
