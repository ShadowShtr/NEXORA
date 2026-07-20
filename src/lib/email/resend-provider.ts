import type { EmailMessage, EmailProvider, EmailSendResult } from './provider';

const RESEND_API_URL = 'https://api.resend.com/emails';

// docs/03_ARCHITECTURE.md: "Primeiro adaptador recomendado: Resend ou equivalente." No
// SDK dependency — Resend's send endpoint is a single small REST call, and a plain
// fetch keeps the same "no dependency for a small, stable surface" posture as
// src/lib/turnstile.ts. Retries (task acceptance criteria: "adapter, template e
// retry") happen at this layer, not the caller's — a transient network/5xx failure is
// retried a bounded number of times before giving up, so every call site gets retry
// behavior for free instead of reimplementing it.
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    let lastError = 'unknown error';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await fetch(RESEND_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: this.from,
            to: message.to,
            subject: message.subject,
            html: message.html,
            text: message.text,
          }),
        });

        if (response.ok) return { ok: true };

        // 4xx (bad request, invalid recipient, auth failure) will not succeed on retry
        // — only 5xx/network errors are worth another attempt.
        if (response.status < 500) {
          return { ok: false, error: `Resend rejected the request (${response.status})` };
        }
        lastError = `Resend returned ${response.status}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'network error';
      }

      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }

    return { ok: false, error: lastError };
  }
}
