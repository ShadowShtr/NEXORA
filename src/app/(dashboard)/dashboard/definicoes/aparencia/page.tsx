import Link from 'next/link';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { publicBookingUrl } from '@/features/onboarding/domain/publish-step';
import { PublicProfileForm } from '@/features/settings/PublicProfileForm';
import { BusinessImageUpload } from '@/features/settings/BusinessImageUpload';
import {
  removeBusinessCover,
  removeBusinessLogo,
  uploadBusinessCover,
  uploadBusinessLogo,
} from '@/features/settings/business-photo-actions';

// NEX-140: relocates the "Perfil público" card (NEX-030's visual refinement) from the
// old flat definições page into its own category, unchanged otherwise.
export default async function AparenciaSettingsPage() {
  const { tenantId } = await requireProfile();
  const supabase = await createClient();

  const [{ data: settings }, { data: tenant }] = await Promise.all([
    supabase
      .from('business_settings')
      .select(
        'specialty, about_description, instagram_handle, logo_path, cover_image_path, booking_enabled',
      )
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase.from('tenants').select('slug').eq('id', tenantId).single(),
  ]);

  const logoUrl = settings?.logo_path
    ? supabase.storage.from('business-logos').getPublicUrl(settings.logo_path).data.publicUrl
    : null;
  const coverUrl = settings?.cover_image_path
    ? supabase.storage.from('business-covers').getPublicUrl(settings.cover_image_path).data
        .publicUrl
    : null;
  const publicUrl = tenant?.slug
    ? publicBookingUrl(publicEnv.NEXT_PUBLIC_APP_URL, tenant.slug)
    : null;

  return (
    <div className="shell">
      <div className="finance-title-row">
        <Link
          href="/dashboard/definicoes"
          className="finance-back-button"
          aria-label="Voltar a Definições"
        >
          <ChevronLeft aria-hidden="true" size={20} />
        </Link>
        <h1 className="more-title">Aparência</h1>
      </div>
      <Card>
        <p className="text-eyebrow">Perfil público</p>
        {publicUrl ? (
          <a href={publicUrl} target="_blank" rel="noreferrer" className="settings-preview-link">
            Ver como a cliente vê
            <ExternalLink aria-hidden="true" size={14} />
          </a>
        ) : null}
        <BusinessImageUpload
          variant="cover"
          imageUrl={coverUrl}
          uploadAction={uploadBusinessCover}
          removeAction={removeBusinessCover}
          label="Imagem de capa"
          hint="PNG ou JPG até 8 MB"
        />
        <BusinessImageUpload
          variant="logo"
          imageUrl={logoUrl}
          uploadAction={uploadBusinessLogo}
          removeAction={removeBusinessLogo}
          label="Logótipo"
          hint="PNG ou JPG até 8 MB"
        />
        <PublicProfileForm
          specialty={settings?.specialty ?? null}
          aboutDescription={settings?.about_description ?? null}
          instagramHandle={settings?.instagram_handle ?? null}
          bookingEnabled={settings?.booking_enabled ?? true}
        />
      </Card>
    </div>
  );
}
