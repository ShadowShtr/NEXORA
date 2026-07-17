// Pure cart logic for building a package's service list (NEX-043): add/remove items and
// recalculate running totals, with duplicate adds blocked rather than silently ignored
// or double-counted.
export type CartItem = {
  serviceId: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
};

export type AddToCartResult = { cart: CartItem[]; blocked: boolean };

export function addToCart(cart: CartItem[], item: CartItem): AddToCartResult {
  if (cart.some((existing) => existing.serviceId === item.serviceId)) {
    return { cart, blocked: true };
  }
  return { cart: [...cart, item], blocked: false };
}

export function removeFromCart(cart: CartItem[], serviceId: string): CartItem[] {
  return cart.filter((item) => item.serviceId !== serviceId);
}

export function cartTotals(cart: CartItem[]): { priceCents: number; durationMinutes: number } {
  return cart.reduce(
    (totals, item) => ({
      priceCents: totals.priceCents + item.priceCents,
      durationMinutes: totals.durationMinutes + item.durationMinutes,
    }),
    { priceCents: 0, durationMinutes: 0 },
  );
}
