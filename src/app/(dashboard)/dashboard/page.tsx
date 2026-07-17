import { Card } from '@/components/ui/Card';
import { LogoutButton } from '@/features/auth/LogoutButton';

export default function DashboardPage() {
  return (
    <main className="shell">
      <p className="eyebrow">Hoje</p>
      <h1>Olá! Vamos organizar o seu dia.</h1>
      <LogoutButton />
      <section className="dashboard-grid" aria-label="Resumo do dia">
        <Card>
          <strong>Próxima cliente</strong>
          <p>Nenhuma marcação.</p>
        </Card>
        <Card>
          <strong>Marcações</strong>
          <p>0 hoje</p>
        </Card>
        <Card>
          <strong>Lembretes</strong>
          <p>0 pendentes</p>
        </Card>
        <Card>
          <strong>Recebido</strong>
          <p>0,00 €</p>
        </Card>
      </section>
    </main>
  );
}
