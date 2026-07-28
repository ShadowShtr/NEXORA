'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

// Native share sheet where available (mobile browsers, most desktop browsers too
// now); clipboard-copy fallback otherwise (older/unsupported browsers) — never a dead
// button.
export function PublicShareButton({ businessName, url }: { businessName: string; url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title: businessName, url });
      } catch {
        // Visitor cancelled the native share sheet — not an error worth surfacing.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (permissions/insecure context) — nothing more to do here.
    }
  }

  return (
    <button type="button" className="public-quick-action" data-type="share" onClick={handleShare}>
      <span className="public-quick-action-icon" aria-hidden="true">
        {copied ? <Check size={19} /> : <Share2 size={19} />}
      </span>
      <span className="public-quick-action-label">{copied ? 'Copiado!' : 'Partilhar'}</span>
    </button>
  );
}
