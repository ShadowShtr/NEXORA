import { Card } from '@/components/ui/Card';

export default function LoginPage() {
  return (
    <main className="shell centered">
      <Card className="auth-card">
        <p className="eyebrow">Área da profissional</p>
        <h1>Entrar</h1>
        <form className="stack" aria-label="Iniciar sessão">
          <label>
            E-mail
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Palavra-passe
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="button" type="submit">
            Entrar
          </button>
        </form>
      </Card>
    </main>
  );
}
