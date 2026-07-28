import type { ReactNode } from 'react';

// Visual identity pass for the 3 auth pages (login, recuperar-password, definir-
// password) — NEX-020/021's own implementation only ever needed to work; this gives
// "a porta de entrada" the same premium/claymorphism language the rest of the app
// already has (NEX-150). Shared by all 3 so a visitor bouncing between "Esqueceu-se
// da palavra-passe?" and back never lands on a jarringly plainer page.
//
// The brand panel is purely decorative marketing copy (a benefit statement + an
// illustrative preview, not a real data view) — desktop-only, aria-hidden so screen
// readers go straight to the actual form. The compact NEXORA mark reuses the exact
// gradient-badge + wordmark language AppShell.tsx's desktop nav already uses
// (.desktop-nav-logo/.app-shell-brand) rather than inventing a new logo treatment or
// referencing an image asset that doesn't exist in this repo.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="login-page">
      <div className="login-shell">
        <div className="login-brand-panel" aria-hidden="true">
          <div>
            <span className="login-brand-logo">
              <span className="login-brand-logo-mark">N</span>
              <span className="login-brand-logo-word">NEXORA</span>
            </span>
            <h2 className="login-brand-title">
              O seu negócio mais simples, organizado e profissional.
            </h2>
            <p className="login-brand-description">
              Controle marcações, clientes, serviços, lembretes e pagamentos num único lugar.
            </p>
          </div>

          <div className="login-app-preview">
            <span className="login-preview-eyebrow">Próxima cliente</span>
            <div className="login-preview-client">
              <span className="login-preview-avatar">AS</span>
              <span className="login-preview-info">
                <span className="login-preview-name">Ana Silva</span>
                <span className="login-preview-meta">14:30 · Manicure Gel</span>
              </span>
            </div>
            <span className="login-preview-bar" />
            <span className="login-preview-bar login-preview-bar-short" />
          </div>
        </div>

        <div className="login-form-panel">
          <span className="login-mobile-logo">
            <span className="login-brand-logo-mark">N</span>
            <span className="login-brand-logo-word">NEXORA</span>
          </span>
          <div className="login-form-content">{children}</div>
        </div>
      </div>
    </main>
  );
}
