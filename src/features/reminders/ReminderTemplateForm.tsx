'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { updateReminderTemplate } from './template-actions';
import {
  DEFAULT_REMINDER_TEMPLATE,
  REMINDER_TEMPLATE_MAX_LENGTH,
  renderReminderTemplate,
} from './domain/template';
import type { Result } from '@/lib/result';

// NEX-104: "Placeholders allowlisted e preview" — the preview below re-renders on every
// keystroke against fixed sample values, purely for the dona to see the shape of her
// own message before saving; the actual allowlist enforcement happens server-side in
// updateReminderTemplate, this is not a security boundary (CLAUDE.md).
const PREVIEW_VALUES = { clientName: 'Ana', dateLabel: 'amanhã', timeLabel: '14:30' };

export function ReminderTemplateForm({ template }: { template: string | null }) {
  const [state, formAction, pending] = useActionState<Result<null> | null, FormData>(
    updateReminderTemplate,
    null,
  );
  const [draft, setDraft] = useState(template ?? DEFAULT_REMINDER_TEMPLATE);

  return (
    <form action={formAction} className="stack">
      <label>
        Mensagem do lembrete
        <textarea
          name="template"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={4}
          maxLength={REMINDER_TEMPLATE_MAX_LENGTH}
          aria-describedby="reminder-template-hint"
        />
      </label>
      <p id="reminder-template-hint" className="text-support">
        Placeholders disponíveis: <code>{'{{cliente}}'}</code>, <code>{'{{data}}'}</code>,{' '}
        <code>{'{{hora}}'}</code>.
      </p>
      <div className="public-summary" aria-live="polite">
        <p className="text-eyebrow">Pré-visualização</p>
        <p>{renderReminderTemplate(draft, PREVIEW_VALUES)}</p>
      </div>
      {state && !state.ok ? (
        <p role="alert" className="form-error">
          {state.error.message}
        </p>
      ) : null}
      {state?.ok ? <p role="status">Mensagem guardada.</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'A guardar…' : 'Guardar mensagem'}
      </Button>
    </form>
  );
}
