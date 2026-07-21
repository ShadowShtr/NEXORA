'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { logout } from '@/features/auth/actions';

// Visual refinement mid-2026 — Mais reference: "Terminar sessão é uma ação secundária
// e potencialmente destrutiva" — discrete red-bordered button (not the primary pink
// button used everywhere else) plus a confirmation step, reusing BottomSheet.tsx (the
// same generic sheet chrome the Serviços redesign introduced) rather than a bespoke
// confirm dialog.
export function LogoutSection() {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button type="button" className="logout-button" onClick={() => setConfirming(true)}>
        <LogOut aria-hidden="true" size={18} />
        Terminar sessão
      </button>

      {confirming ? (
        <BottomSheet title="Terminar sessão?" onClose={() => setConfirming(false)}>
          <p className="text-support">Terá de iniciar sessão novamente para aceder à NEXORA.</p>
          <div className="wizard-actions">
            <form action={logout} className="logout-confirm-form">
              <Button type="submit" className="logout-confirm-button">
                Terminar sessão
              </Button>
            </form>
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
          </div>
        </BottomSheet>
      ) : null}
    </>
  );
}
