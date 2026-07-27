import { NextResponse } from 'next/server';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { parseClientPreferences } from '@/features/clients/domain/preferences';
import { buildClientExport } from '@/features/clients/domain/export';
import { isClientPhotoKind } from '@/features/clients/domain/photos';
import { errorMessage, logEvent } from '@/lib/logger';
import { getRequestId } from '@/lib/request-id';

// NEX-162: "Exportar dados da cliente — export tenant-scoped e minimizado." A GET
// route (not a Server Action) so a plain <a> download link works without client JS —
// same shape as the finance export routes (NEX-132). requireProfile() redirects an
// unauthenticated caller to /login; tenantId comes only from that session, and every
// query below filters on it, so this can only ever export a client that belongs to the
// caller's own tenant — a client id from another tenant resolves to 404, same as the
// client detail page itself (src/app/(dashboard)/dashboard/clientes/[id]/page.tsx).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { tenantId } = await requireProfile();
  const requestId = await getRequestId();
  const { id } = await params;
  const supabase = await createClient();

  const { data: client } = await supabase
    .from('clients')
    .select('name, phone_e164, email, preferences, private_notes, first_seen_at')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!client) {
    return NextResponse.json({ error: 'Cliente não encontrada.' }, { status: 404 });
  }

  // NEX-171: see api/financeiro/export/route.ts for why requireProfile() (and the
  // client existence check above, which is a real 404, not a failure) stay outside
  // this block.
  try {
    const [{ data: appointments }, { data: photos }] = await Promise.all([
      supabase
        .from('appointments')
        .select(
          'start_at, status, expected_total_cents, final_total_cents, appointment_items(description), payments(method, status)',
        )
        .eq('client_id', id)
        .eq('tenant_id', tenantId)
        .order('start_at', { ascending: false }),
      supabase
        .from('client_photos')
        .select('kind, created_at')
        .eq('client_id', id)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
    ]);

    const payload = buildClientExport({
      now: new Date(),
      client: {
        name: client.name,
        phone: client.phone_e164,
        email: client.email,
        firstSeenAt: client.first_seen_at,
        preferences: parseClientPreferences(client.preferences),
        privateNotes: client.private_notes ?? '',
      },
      appointments: appointments ?? [],
      photos: (photos ?? []).map((photo) => ({
        kind: isClientPhotoKind(photo.kind) ? photo.kind : 'other',
        created_at: photo.created_at,
      })),
    });

    logEvent('info', 'clients.export.succeeded', { tenantId }, requestId);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="cliente-${id}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logEvent(
      'error',
      'clients.export.failed',
      { tenantId, message: errorMessage(error) },
      requestId,
    );
    return NextResponse.json(
      { error: 'Não foi possível gerar a exportação.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
