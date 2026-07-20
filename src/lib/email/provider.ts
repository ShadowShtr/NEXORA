// docs/03_ARCHITECTURE.md, "E-mail": "Interface EmailProvider desacoplada." Every
// call site (NEX-074's booking confirmation, future NEX-100+ reminders) depends only on
// this interface, never on a concrete provider — swapping Resend for another provider
// later touches one adapter file, not every caller.
export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type EmailSendResult = { ok: true } | { ok: false; error: string };

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
