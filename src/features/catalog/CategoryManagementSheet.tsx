'use client';

import { useActionState, useRef, useState } from 'react';
import { GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { createCategory, moveCategory, renameCategory, toggleCategoryVisibility } from './actions';
import type { CategoryListItem } from './domain/category';
import type { Result } from '@/lib/result';

// Visual refinement mid-2026 — Serviços reference: "isso elimina a necessidade de
// botões: subir; descer; guardar; ocultar" describes real drag-and-drop reordering,
// which doesn't exist anywhere in this app yet (no dnd library, no pointer-based
// reorder — a genuinely new capability, not a restyle). Kept the existing swap-based
// up/down reorder (already real, already tested) as compact icon buttons instead of
// rushing a drag implementation for this pass — the grip icon is still shown for the
// reference's visual language, it just isn't draggable yet.
function CategoryRow({
  category,
  isFirst,
  isLast,
}: {
  category: CategoryListItem;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [renameState, renameFormAction] = useActionState<Result<null> | null, FormData>(
    renameCategory,
    null,
  );
  const [, toggleFormAction, togglePending] = useActionState<Result<null> | null, FormData>(
    toggleCategoryVisibility,
    null,
  );
  const [, moveFormAction, movePending] = useActionState<Result<null> | null, FormData>(
    moveCategory,
    null,
  );
  const [isVisible, setIsVisible] = useState(category.isVisible);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const error = renameState && !renameState.ok ? renameState.error.message : null;

  return (
    <li className="category-management-item">
      <GripVertical aria-hidden="true" className="category-drag-handle" />

      {editing ? (
        <form
          action={(formData) => {
            renameFormAction(formData);
            setEditing(false);
          }}
          className="category-rename-form"
        >
          <input type="hidden" name="id" value={category.id} />
          <input
            ref={inputRef}
            name="name"
            defaultValue={category.name}
            maxLength={80}
            required
            autoFocus
            className="category-rename-input"
            aria-label={`Nome da categoria ${category.name}`}
            onBlur={(event) => event.currentTarget.form?.requestSubmit()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setEditing(false);
            }}
          />
        </form>
      ) : (
        <button type="button" className="category-management-name" onClick={() => setEditing(true)}>
          {category.name}
        </button>
      )}

      <span className="category-management-status">{isVisible ? 'Ativa' : 'Oculta'}</span>

      <div className="category-management-actions">
        <button
          type="button"
          className="category-reorder-button"
          disabled={movePending || isFirst}
          aria-label="Mover para cima"
          onClick={() => {
            const formData = new FormData();
            formData.set('id', category.id);
            formData.set('direction', 'up');
            moveFormAction(formData);
          }}
        >
          <ChevronUp aria-hidden="true" size={16} />
        </button>
        <button
          type="button"
          className="category-reorder-button"
          disabled={movePending || isLast}
          aria-label="Mover para baixo"
          onClick={() => {
            const formData = new FormData();
            formData.set('id', category.id);
            formData.set('direction', 'down');
            moveFormAction(formData);
          }}
        >
          <ChevronDown aria-hidden="true" size={16} />
        </button>
        <button
          type="button"
          className="category-visibility-toggle"
          data-active={isVisible || undefined}
          role="switch"
          aria-checked={isVisible}
          aria-label={isVisible ? 'Ocultar categoria' : 'Mostrar categoria'}
          disabled={togglePending}
          onClick={() => {
            setIsVisible((current) => !current);
            const formData = new FormData();
            formData.set('id', category.id);
            toggleFormAction(formData);
          }}
        />
      </div>

      {error ? (
        <p role="alert" className="form-error category-management-error">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function CategoryManagementSheet({
  categories,
  onClose,
}: {
  categories: CategoryListItem[];
  onClose: () => void;
}) {
  const [createState, createFormAction, createPending] = useActionState<
    Result<null> | null,
    FormData
  >(createCategory, null);
  const ordered = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <BottomSheet
      title="Gerir categorias"
      subtitle="Organize a forma como os seus serviços aparecem."
      onClose={onClose}
    >
      <div className="stack">
        {ordered.length === 0 ? (
          <p className="text-support">Ainda não tem categorias.</p>
        ) : (
          <ul className="category-management-list">
            {ordered.map((category, index) => (
              <CategoryRow
                key={category.id}
                category={category}
                isFirst={index === 0}
                isLast={index === ordered.length - 1}
              />
            ))}
          </ul>
        )}

        <form action={createFormAction} className="category-add-form">
          <input
            name="name"
            required
            maxLength={80}
            placeholder="Nova categoria"
            aria-label="Nova categoria"
            className="form-input"
          />
          <Button type="submit" disabled={createPending}>
            {createPending ? 'A criar…' : 'Criar categoria'}
          </Button>
        </form>
        {createState && !createState.ok ? (
          <p role="alert" className="form-error">
            {createState.error.message}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}
