import type { PublicBookingResult } from './public-booking-result';

// NEX-BOOKING-RACE-001 follow-up: one discriminated state instead of several independent
// booleans (isBooking/bookingError/confirmedBooking), which could previously combine
// into contradictory shapes (e.g. isBooking=true while confirmedBooking was already
// set). A reducer over plain data is also testable without rendering React.
export type ConfirmationState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; bookingToken: string; lookupCode: string }
  | { status: 'conflict'; message: string }
  | { status: 'error'; message: string };

export type ConfirmationAction =
  | { type: 'SUBMIT_STARTED' }
  | { type: 'RESULT_RECEIVED'; result: PublicBookingResult }
  | { type: 'REQUEST_FAILED'; message: string }
  | { type: 'TIMED_OUT' };

export const INITIAL_CONFIRMATION_STATE: ConfirmationState = { status: 'idle' };

export function confirmationReducer(
  _state: ConfirmationState,
  action: ConfirmationAction,
): ConfirmationState {
  switch (action.type) {
    case 'SUBMIT_STARTED':
      return { status: 'submitting' };

    case 'RESULT_RECEIVED': {
      const { result } = action;
      // bookingToken/lookupCode are only absent for a booking created without them ever
      // being generated (shouldn't happen in practice, but the RPC's return row types
      // them nullable) — matches the pre-refactor behavior of only rendering the
      // confirmation screen once both are present, rather than rendering it with blanks.
      if (result.ok && result.bookingToken && result.lookupCode) {
        return {
          status: 'success',
          bookingToken: result.bookingToken,
          lookupCode: result.lookupCode,
        };
      }
      if (result.ok) {
        return { status: 'idle' };
      }
      if (result.code === 'SLOT_TAKEN') {
        return { status: 'conflict', message: result.message };
      }
      return { status: 'error', message: result.message };
    }

    case 'REQUEST_FAILED':
      return { status: 'error', message: action.message };

    case 'TIMED_OUT':
      return {
        status: 'error',
        message: 'A confirmação demorou demasiado. Verifique a marcação antes de tentar novamente.',
      };

    default:
      return _state;
  }
}
