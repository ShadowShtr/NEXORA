import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { requireProfile } from '@/lib/auth/require-profile';

// NEX-140: a única exportação de dados que já existe é a financeira (NEX-132/133/134),
// que vive em /dashboard/financeiro (precisa do período selecionado nesse ecrã) — aqui
// só um link para lá, não uma cópia da funcionalidade. Exportar dados de clientes fica
// para NEX-162, fora do escopo desta tarefa.
export default async function DadosSettingsPage() {
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
        <h1 className="more-title">Dados</h1>
      </div>
      <Card>
        <p className="text-eyebrow">Exportações financeiras</p>
        <p className="text-support">
          CSV, Excel ou PDF das transações de um período, a partir do dashboard financeiro.
        </p>
        <Link href="/dashboard/financeiro" className="settings-preview-link">
          Ir para Financeiro
        </Link>
      </Card>
    </div>
  );
}
