'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

// docs/UI_SCREEN_SPECIFICATIONS.md #14/#15 (fecho rápido/detalhado). <dialog> nativo dá
// focus trap, tecla Esc (onCancel) e ::backdrop de origem sem JS extra — só sincronizamos
// showModal()/close() com a prop `open` porque React não tem equivalente declarativo.
export function Modal({ open, onClose, title, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="nx-modal"
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => {
        // Clicar no ::backdrop dispara o evento com target === o próprio <dialog>
        // (nenhum elemento de conteúdo cobre essa área); um clique dentro do conteúdo
        // borbulha a partir de um nó filho, nunca do dialog em si.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="nx-modal-header">
        <h2 className="nx-modal-title">{title}</h2>
        <button type="button" className="nx-modal-close" onClick={onClose} aria-label="Fechar">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
