import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';

// NEX-140: sem nenhuma definição de métodos de pagamento aceites hoje (dinheiro/MB WAY
// já são as únicas opções em todo o lado que regista um pagamento, ver
// supabase/migrations/0001_initial.sql) — construir uma seria expandir o escopo desta
// tarefa (só reorganizar o que já existe em cartões), por isso é só um placeholder.
export default async function PagamentosSettingsPage() {
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
        <h1 className="more-title">Pagamentos</h1>
      </div>
      <Card>
        <p className="text-support">Esta área fica disponível numa próxima atualização.</p>
      </Card>
    </div>
  );
}
