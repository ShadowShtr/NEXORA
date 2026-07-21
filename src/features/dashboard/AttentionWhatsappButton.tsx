'use client';

import { MessageCircle } from 'lucide-react';
import { markReminderOpened } from '@/features/reminders/actions';

// Same fire-and-forget audit call as ReminderCard.tsx's handleWhatsappClick (NEX-103) —
// the home preview opens the same underlying reminder, so it must record "aberto" the
// same way the full Lembretes page does, not silently skip the audit trail.
export function AttentionWhatsappButton({
  reminderId,
  whatsappHref,
  clientName,
}: {
  reminderId: string;
  whatsappHref: string;
  clientName: string;
}) {
  function handleClick() {
    const formData = new FormData();
    formData.set('reminderId', reminderId);
    void markReminderOpened(null, formData);
  }

  return (
    <a
      className="reminder-whatsapp-button"
      href={whatsappHref}
      target="_blank"
      rel="noreferrer"
      onClick={handleClick}
      aria-label={`Abrir WhatsApp com ${clientName}`}
    >
      <MessageCircle aria-hidden="true" size={18} />
    </a>
  );
}
