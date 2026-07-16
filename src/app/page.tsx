import Link from 'next/link';
import { CalendarDays, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';

export default function HomePage() {
  return (
    <main className="shell landing">
      <Card className="hero">
        <span className="eyebrow">
          <Sparkles aria-hidden="true" /> Agenda simples e elegante
        </span>
        <h1>NEXORA</h1>
        <p>Uma base inteligente para marcações, clientes e recebimentos.</p>
        <Link className="button link-button" href="/login">
          <CalendarDays aria-hidden="true" /> Entrar na área da profissional
        </Link>
      </Card>
    </main>
  );
}
