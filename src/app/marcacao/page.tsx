import { Card } from '@/components/ui/Card';
import { LookupForm } from './LookupForm';

// "Consultar marcação por código" — the alternative entry point to /marcacao/[token]
// for a client who no longer has the original link but remembers the short code shown
// on the confirmation screen (BookingConfirmation.tsx) and sent in the confirmation
// e-mail (booking-confirmation-template.ts).
export default function BookingLookupPage() {
  return (
    <main className="shell stack">
      <Card className="public-header">
        <p className="text-eyebrow">NEXORA</p>
        <h1 className="text-title">Consultar marcação</h1>
        <p className="text-support">
          Introduza o código de 8 caracteres que recebeu na confirmação.
        </p>
      </Card>
      <Card>
        <LookupForm />
      </Card>
    </main>
  );
}
