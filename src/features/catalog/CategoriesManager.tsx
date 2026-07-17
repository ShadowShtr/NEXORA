'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  createCategory,
  moveCategory,
  renameCategory,
  toggleCategoryVisibility,
} from '@/features/catalog/actions';
import type { CategoryListItem } from '@/features/catalog/domain/category';
import type { Result } from '@/lib/result';

type CategoryRowProps = {
  category: CategoryListItem;
  isFirst: boolean;
  isLast: boolean;
};

function CategoryRow({ category, isFirst, isLast }: CategoryRowProps) {
  const [renameState, renameFormAction, renamePending] = useActionState<
    Result<null> | null,
    FormData
  >(renameCategory, null);
  const [toggleState, toggleFormAction, togglePending] = useActionState<
    Result<null> | null,
    FormData
  >(toggleCategoryVisibility, null);
  const [moveState, moveFormAction, movePending] = useActionState<Result<null> | null, FormData>(
    moveCategory,
    null,
  );

  const error = [renameState, toggleState, moveState].find((state) => state && !state.ok) as
    { ok: false; error: { message: string } } | undefined;

  return (
    <li className="catalog-row">
      <form className="catalog-row-name" action={renameFormAction}>
        <input type="hidden" name="id" value={category.id} />
        <input
          name="name"
          defaultValue={category.name}
          maxLength={80}
          required
          aria-label={`Nome da categoria ${category.name}`}
        />
        <Button type="submit" disabled={renamePending}>
          Guardar
        </Button>
      </form>

      <div className="catalog-row-actions">
        <form action={moveFormAction}>
          <input type="hidden" name="id" value={category.id} />
          <input type="hidden" name="direction" value="up" />
          <Button type="submit" disabled={movePending || isFirst} aria-label="Mover para cima">
            ↑
          </Button>
        </form>
        <form action={moveFormAction}>
          <input type="hidden" name="id" value={category.id} />
          <input type="hidden" name="direction" value="down" />
          <Button type="submit" disabled={movePending || isLast} aria-label="Mover para baixo">
            ↓
          </Button>
        </form>
        <form action={toggleFormAction}>
          <input type="hidden" name="id" value={category.id} />
          <Button type="submit" disabled={togglePending}>
            {category.isVisible ? 'Ocultar' : 'Mostrar'}
          </Button>
        </form>
      </div>

      {!category.isVisible ? <p className="catalog-hidden-badge">Oculta da cliente</p> : null}
      {error ? (
        <p role="alert" className="form-error">
          {error.error.message}
        </p>
      ) : null}
    </li>
  );
}

export function CategoriesManager({ categories }: { categories: CategoryListItem[] }) {
  const [createState, createFormAction, createPending] = useActionState<
    Result<null> | null,
    FormData
  >(createCategory, null);
  const ordered = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section className="stack" aria-label="Categorias">
      <h2>Categorias</h2>
      {ordered.length === 0 ? (
        <p>Ainda não tem categorias.</p>
      ) : (
        <ul className="catalog-list">
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

      <form className="stack" aria-label="Nova categoria" action={createFormAction}>
        <label>
          Nova categoria
          <input name="name" required maxLength={80} placeholder="Manicure" />
        </label>
        {createState && !createState.ok ? (
          <p role="alert" className="form-error">
            {createState.error.message}
          </p>
        ) : null}
        <Button type="submit" disabled={createPending}>
          {createPending ? 'A criar…' : 'Criar categoria'}
        </Button>
      </form>
    </section>
  );
}
