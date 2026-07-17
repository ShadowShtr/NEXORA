import { z } from 'zod';

// Matches the `service_categories.name` check constraint (0001_initial.sql).
export const categoryNameSchema = z
  .string()
  .trim()
  .min(1, 'O nome não pode ficar vazio.')
  .max(80, 'O nome deve ter no máximo 80 caracteres.');

export const createCategorySchema = z.object({ name: categoryNameSchema });
export const renameCategorySchema = z.object({ id: z.uuid(), name: categoryNameSchema });
export const categoryIdSchema = z.object({ id: z.uuid() });
export const moveCategorySchema = z.object({
  id: z.uuid(),
  direction: z.enum(['up', 'down']),
});

export type CategoryListItem = {
  id: string;
  name: string;
  sortOrder: number;
  isVisible: boolean;
};

// Where a category currently sits within its tenant's ordered list, and what its
// immediate neighbour in the requested direction is — the two rows a "mover" swaps
// sort_order between. Returns null when there is no neighbour (already at that end).
export function findSwapTarget(
  categories: CategoryListItem[],
  id: string,
  direction: 'up' | 'down',
): { current: CategoryListItem; neighbour: CategoryListItem } | null {
  const ordered = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const index = ordered.findIndex((category) => category.id === id);
  if (index === -1) return null;

  const neighbourIndex = direction === 'up' ? index - 1 : index + 1;
  if (neighbourIndex < 0 || neighbourIndex >= ordered.length) return null;

  return { current: ordered[index]!, neighbour: ordered[neighbourIndex]! };
}
