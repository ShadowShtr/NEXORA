import { describe, expect, it } from 'vitest';
import {
  categoryNameSchema,
  findSwapTarget,
  type CategoryListItem,
} from '@/features/catalog/domain/category';

describe('categoryNameSchema', () => {
  it('accepts a normal name', () => {
    expect(categoryNameSchema.safeParse('Manicure').success).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    const result = categoryNameSchema.safeParse('  Pedicure  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('Pedicure');
  });

  it('rejects an empty name', () => {
    expect(categoryNameSchema.safeParse('   ').success).toBe(false);
  });

  it('rejects a name over 80 characters', () => {
    expect(categoryNameSchema.safeParse('a'.repeat(81)).success).toBe(false);
  });

  it('accepts a name at exactly 80 characters', () => {
    expect(categoryNameSchema.safeParse('a'.repeat(80)).success).toBe(true);
  });
});

describe('findSwapTarget', () => {
  const categories: CategoryListItem[] = [
    { id: 'a', name: 'Manicure', sortOrder: 0, isVisible: true },
    { id: 'b', name: 'Pedicure', sortOrder: 1, isVisible: true },
    { id: 'c', name: 'Sobrancelhas', sortOrder: 2, isVisible: false },
  ];

  it('moving the middle item up swaps it with the first', () => {
    const swap = findSwapTarget(categories, 'b', 'up');
    expect(swap).toMatchObject({ current: { id: 'b' }, neighbour: { id: 'a' } });
  });

  it('moving the middle item down swaps it with the last', () => {
    const swap = findSwapTarget(categories, 'b', 'down');
    expect(swap).toMatchObject({ current: { id: 'b' }, neighbour: { id: 'c' } });
  });

  it('moving the first item up has no target', () => {
    expect(findSwapTarget(categories, 'a', 'up')).toBeNull();
  });

  it('moving the last item down has no target', () => {
    expect(findSwapTarget(categories, 'c', 'down')).toBeNull();
  });

  it('an unknown id has no target', () => {
    expect(findSwapTarget(categories, 'missing', 'up')).toBeNull();
  });

  it('sorts by sortOrder before locating neighbours, regardless of input array order', () => {
    const shuffled = [categories[2]!, categories[0]!, categories[1]!];
    const swap = findSwapTarget(shuffled, 'a', 'down');
    expect(swap).toMatchObject({ current: { id: 'a' }, neighbour: { id: 'b' } });
  });
});
