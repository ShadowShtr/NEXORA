'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth/require-profile';
import { findDisallowedPlaceholders, REMINDER_TEMPLATE_MAX_LENGTH } from './domain/template';
import { hasAffectedRows } from '@/lib/write-confirmation';
import type { Result } from '@/lib/result';

const updateTemplateSchema = z.object({
  template: z.string().trim().max(REMINDER_TEMPLATE_MAX_LENGTH),
});

// NEX-104: business_settings is a plain per-tenant settings row the owner writes
// directly to (same pattern as updateNoShowPolicy, src/features/settings/no-show-policy-actions.ts),
// not a security-definer RPC — RLS (via createClient(), cookie-scoped) is the actual
// authorization boundary here. An empty template means "use the built-in default"
// (stored as null), matching 0014_reminder_template.sql's default. The allowlist check
// (findDisallowedPlaceholders) is the actual enforcement of this task's "Placeholders
// allowlisted" criterion — it runs here, not just client-side, since the client is
// never a security boundary (CLAUDE.md).
export async function updateReminderTemplate(
  _prevState: Result<null> | null,
  formData: FormData,
): Promise<Result<null>> {
  const parsed = updateTemplateSchema.safeParse({ template: formData.get('template') ?? '' });
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: 'Mensagem demasiado longa.' },
    };
  }

  const template = parsed.data.template;
  if (template) {
    const disallowed = findDisallowedPlaceholders(template);
    if (disallowed.length > 0) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Placeholder não permitido: ${disallowed.join(', ')}. Use apenas {{cliente}}, {{data}} ou {{hora}}.`,
        },
      };
    }
  }

  const { tenantId } = await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('business_settings')
    .update({ reminder_message_template: template === '' ? null : template })
    .eq('tenant_id', tenantId)
    .select('tenant_id');

  if (error || !hasAffectedRows(data)) {
    return {
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Não foi possível guardar. Tente novamente.' },
    };
  }

  revalidatePath('/dashboard/definicoes');
  return { ok: true, value: null };
}
