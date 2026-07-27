import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DadosClient } from './DadosClient';

export default async function DadosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!tenant) notFound();

  // NEX-166 (security review): the sibling public pages (page.tsx, servicos, horario,
  // resumo) all also check business_settings.published_at before rendering — this page
  // was missing that second check. Not exploitable today (status='active' is only ever
  // set together with published_at, by publish_business), but it's a fragile
  // inconsistency: a future "unpublish without suspending" flow would silently leave
  // this one page reachable while its siblings correctly 404.
  const { data: settings } = await supabase
    .from('business_settings')
    .select('tenant_id')
    .eq('tenant_id', tenant.id)
    .maybeSingle();
  if (!settings) notFound();

  return <DadosClient tenantId={tenant.id} tenantSlug={slug} />;
}
