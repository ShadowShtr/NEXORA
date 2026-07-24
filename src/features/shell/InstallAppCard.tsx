'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

// NEX-152: "Manifest e instalação PWA — instruções." Android/desktop Chrome fire
// `beforeinstallprompt`, which lets the app trigger the native install flow directly;
// iOS Safari never fires it and has no programmatic install API at all — "Adicionar ao
// Ecrã Principal" only exists as a manual step inside the Partilhar menu, so the only
// thing this can do for iOS is say where to find it. Renders nothing once the app is
// already running standalone (nothing left to install), and nothing on a browser that
// offers neither path (nothing actionable to show).
export function InstallAppCard() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  // Starts as "standalone" so the server render (and first client paint, before
  // hydration effects run) shows nothing — matchMedia/userAgent don't exist during SSR,
  // so this can only be read after mount.
  const [{ isStandalone, isIOS }, setInstallPath] = useState({
    isStandalone: true,
    isIOS: false,
  });

  useEffect(() => {
    // One-time read of browser-only state on mount, not a response to an external
    // system's update — matchMedia/userAgent are unavailable during SSR and there is no
    // way to know them before the first client render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInstallPath({
      isStandalone:
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
      isIOS: /iphone|ipad|ipod/i.test(window.navigator.userAgent),
    });

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  if (isStandalone || (!installEvent && !isIOS)) return null;

  return (
    <div className="more-section-card more-install-card">
      <div className="more-menu-icon" aria-hidden="true">
        <Download size={18} />
      </div>
      <div className="more-install-text">
        <p className="more-install-title">Instalar a aplicação</p>
        {installEvent ? (
          <p className="text-support">Acesso mais rápido, direto do ecrã principal.</p>
        ) : (
          <p className="text-support">
            No iPhone: toque em Partilhar e depois em &quot;Adicionar ao Ecrã Principal&quot;.
          </p>
        )}
      </div>
      {installEvent ? (
        <Button
          type="button"
          variant="secondary"
          onClick={async () => {
            await installEvent.prompt();
            setInstallEvent(null);
          }}
        >
          Instalar
        </Button>
      ) : null}
    </div>
  );
}
