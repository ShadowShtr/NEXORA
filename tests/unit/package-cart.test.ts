import { describe, expect, it } from 'vitest';
import { addToCart, cartTotals, removeFromCart } from '@/features/catalog/domain/package-cart';

const verniz = { serviceId: 'a', name: 'Verniz gel', priceCents: 2500, durationMinutes: 60 };
const pedicure = { serviceId: 'b', name: 'Pedicure spa', priceCents: 3000, durationMinutes: 45 };

describe('addToCart', () => {
  it('adds a new item to an empty cart', () => {
    const result = addToCart([], verniz);
    expect(result.blocked).toBe(false);
    expect(result.cart).toEqual([verniz]);
  });

  it('adds a second, different item', () => {
    const result = addToCart([verniz], pedicure);
    expect(result.blocked).toBe(false);
    expect(result.cart).toEqual([verniz, pedicure]);
  });

  it('blocks adding the same service twice and leaves the cart unchanged', () => {
    const result = addToCart([verniz], { ...verniz, priceCents: 999 });
    expect(result.blocked).toBe(true);
    expect(result.cart).toEqual([verniz]);
  });

  it('does not mutate the original cart array', () => {
    const original = [verniz];
    addToCart(original, pedicure);
    expect(original).toEqual([verniz]);
  });
});

describe('removeFromCart', () => {
  it('removes the matching item', () => {
    expect(removeFromCart([verniz, pedicure], 'a')).toEqual([pedicure]);
  });

  it('is a no-op when the id is not present', () => {
    expect(removeFromCart([verniz], 'missing')).toEqual([verniz]);
  });

  it('returns an empty cart when removing the last item', () => {
    expect(removeFromCart([verniz], 'a')).toEqual([]);
  });
});

describe('cartTotals', () => {
  it('sums price and duration across all items', () => {
    expect(cartTotals([verniz, pedicure])).toEqual({ priceCents: 5500, durationMinutes: 105 });
  });

  it('is {0, 0} for an empty cart', () => {
    expect(cartTotals([])).toEqual({ priceCents: 0, durationMinutes: 0 });
  });

  it('recalculates correctly after an add followed by a remove', () => {
    const afterAdd = addToCart([verniz], pedicure).cart;
    const afterRemove = removeFromCart(afterAdd, 'a');
    expect(cartTotals(afterRemove)).toEqual({ priceCents: 3000, durationMinutes: 45 });
  });
});
