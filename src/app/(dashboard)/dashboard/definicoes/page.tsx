import { ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { publicBookingUrl } from '@/features/onboarding/domain/publish-step';
import { NoShowPolicyForm } from '@/features/settings/NoShowPolicyForm';
import { ReminderTemplateForm } from '@/features/reminders/ReminderTemplateForm';
import { PublicProfileForm } from '@/features/settings/PublicProfileForm';
import { BusinessImageUpload } from '@/features/settings/BusinessImageUpload';
import {
  removeBusinessCover,
  removeBusinessLogo,
  uploadBusinessCover,
  uploadBusinessLogo,
} from '@/features/settings/business-photo-actions';
import { AvailabilityBlocksManager } from '@/features/settings/AvailabilityBlocksManager';

// NEX-095/NEX-104: the rest of this page (EPIC-14, "Central de definições em cartões")
// is not built yet — this only adds the cards asked for by those two tasks (plus the
// public-profile card added alongside the /b/[slug] visual refinement), without
// expanding into the full settings hub.
export default async function DefinicoesPage() {
  const { tenantId } = await requireProfile();
  const supabase = await createClient();
  const [{ data: settings }, { data: tenant }, { data: blockRows }] = await Promise.all([
    supabase
      .from('business_settings')
      .select(
        'no_show_limit, no_show_window_days, reminder_message_template, specialty, about_description, instagram_handle, logo_path, cover_image_path, booking_enabled, timezone',
      )
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    supabase.from('tenants').select('slug').eq('id', tenantId).single(),
    supabase
      .from('availability_blocks')
      .select('id, starts_at, ends_at, reason, is_all_day')
      .eq('tenant_id', tenantId)
      .gt('ends_at', new Date().toISOString())
      .order('starts_at'),
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
      <p className="text-eyebrow">Definições</p>
      <h1 className="text-title">Definições</h1>
      <Card>
        <p className="text-support">Esta área fica disponível numa próxima atualização.</p>
      </Card>
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
      <Card>
        <p className="text-eyebrow">Política de faltas</p>
        <NoShowPolicyForm
          noShowLimit={settings?.no_show_limit ?? null}
          noShowWindowDays={settings?.no_show_window_days ?? 90}
        />
      </Card>
      <Card>
        <p className="text-eyebrow">Mensagem do lembrete</p>
        <ReminderTemplateForm template={settings?.reminder_message_template ?? null} />
      </Card>
      <Card>
        <p className="text-eyebrow">Bloqueios de agenda</p>
        <AvailabilityBlocksManager
          blocks={(blockRows ?? []).map((block) => ({
            id: block.id,
            startsAt: block.starts_at,
            endsAt: block.ends_at,
            reason: block.reason,
            isAllDay: block.is_all_day,
          }))}
          timezone={settings?.timezone ?? 'Europe/Lisbon'}
        />
      </Card>
    </div>
  );
}
