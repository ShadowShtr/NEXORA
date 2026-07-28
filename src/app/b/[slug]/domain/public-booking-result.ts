// NEX-BOOKING-RACE-001 follow-up: a single discriminated contract for the outcome of
// POST /api/public/business/{slug}/bookings, shared by the route handler (server) and
// submitPublicBooking (client) so neither side can drift from the other's shape. A
// SLOT_TAKEN conflict is HTTP 409 but still a normal, expected outcome — it's `ok: false`
// with a `code`, not an exception.
export type PublicBookingResult =
  | {
      ok: true;
      code: 'BOOKING_CREATED';
      appointmentId: string;
      bookingToken: string | null;
      lookupCode: string | null;
      isReplay: boolean;
    }
  | {
      ok: false;
      code: 'SLOT_TAKEN';
      message: string;
    }
  | {
      ok: false;
      code:
        | 'VALIDATION_ERROR'
        | 'NOT_FOUND'
        | 'IDEMPOTENCY_CONFLICT'
        | 'RATE_LIMITED'
        | 'INTERNAL_ERROR';
      message: string;
    };
