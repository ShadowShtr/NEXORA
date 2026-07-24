'use client';

import { useId } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        },
      ) => string;
    };
  }
}

// NEX-066: client-side half of the Turnstile challenge. verifyTurnstileToken
// (src/lib/turnstile.ts) already validates the token server-side and no-ops when
// TURNSTILE_SECRET_KEY is unset — this widget is the piece that was missing: without it
// turnstileToken never reaches createPublicBooking, so a configured secret key would
// reject every real visitor. Rendered only when the public site key is configured
// (see call site), so nothing changes for environments that haven't provisioned
// Turnstile yet.
export function TurnstileWidget({
  siteKey,
  onToken,
}: {
  siteKey: string;
  onToken: (token: string | null) => void;
}) {
  const containerId = `turnstile-${useId().replace(/:/g, '')}`;

  return (
    <>
      <div id={containerId} className="public-turnstile-widget" />
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
        onReady={() => {
          window.turnstile?.render(`#${containerId}`, {
            sitekey: siteKey,
            callback: (token) => onToken(token),
            'expired-callback': () => onToken(null),
            'error-callback': () => onToken(null),
          });
        }}
      />
    </>
  );
}
