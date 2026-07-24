import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';

// NEX-140: nome/telefone/morada só se definem hoje no onboarding (NEX-031), sem forma
// de os editar depois — construir esse formulário fica fora do escopo desta tarefa
// (só reorganizar o que já existe em cartões), por isso esta categoria é só um
// placeholder por agora.
export default async function NegocioSettingsPage() {
  await requireProfile();

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
        <h1 className="more-title">Negócio</h1>
      </div>
      <Card>
        <p className="text-support">Esta área fica disponível numa próxima atualização.</p>
      </Card>
    </div>
  );
}
