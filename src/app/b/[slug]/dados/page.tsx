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

  return <DadosClient tenantId={tenant.id} tenantSlug={slug} />;
}
