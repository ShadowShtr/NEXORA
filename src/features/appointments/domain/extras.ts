// NEX-111: "Ver mais... extra pode ser serviço existente ou ajuste manual"
// (docs/01_PRODUCT_REQUIREMENTS.md §9). ServiceExtra references a catalog service by
// id — its price is a client-side snapshot only for display (the RPC always re-prices
// from the live catalog, 0016_complete_appointment_extras.sql); ManualExtra's price is
// authoritative as typed, same trust boundary as the completion's own final total.
export interface ServiceExtra {
  kind: 'service';
  serviceId: string;
  name: string;
  priceCents: number;
}

export interface ManualExtra {
  kind: 'manual';
  description: string;
  unitPriceCents: number;
}

export type Extra = ServiceExtra | ManualExtra;

// A catalog service offered as a pickable extra — the shape the agenda page loads
// once (active services only) and passes down to every card, rather than each card
// fetching its own copy.
export interface AvailableService {
  id: string;
  name: string;
  priceCents: number;
}

export function extraPriceCents(extra: Extra): number {
  return extra.kind === 'service' ? extra.priceCents : extra.unitPriceCents;
}

// The completion panel's final-total field is pre-filled from this sum (expected total
// + every extra added so far) but always stays independently editable — adding an
// extra recomputes the suggestion, it never overwrites a value the owner already typed
// by hand, since "valor final é ajustável" is the product's own rule.
export function sumExtrasCents(extras: Extra[]): number {
  return extras.reduce((sum, extra) => sum + extraPriceCents(extra), 0);
}
