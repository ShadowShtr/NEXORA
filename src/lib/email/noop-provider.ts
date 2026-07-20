import type { EmailMessage, EmailProvider, EmailSendResult } from './provider';

// EMAIL_FROM/EMAIL_PROVIDER_API_KEY are optional (docs/ENVIRONMENTS_AND_SECRETS.md —
// not yet provisioned for this project, same posture as RATE_LIMIT_REDIS_*/
// TURNSTILE_SECRET_KEY in NEX-066). Without them, e-mail is a no-op that always
// succeeds rather than an error every caller would have to special-case — CLAUDE.md/
// this task's own acceptance criteria: "booking não depende de entrega."
export class NoopEmailProvider implements EmailProvider {
  async send(_message: EmailMessage): Promise<EmailSendResult> {
    return { ok: true };
  }
}
