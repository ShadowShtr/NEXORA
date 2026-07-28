import { describe, expect, it } from 'vitest';
import {
  confirmationReducer,
  INITIAL_CONFIRMATION_STATE,
  type ConfirmationState,
} from '@/app/b/[slug]/domain/confirmation-state';
import type { PublicBookingResult } from '@/app/b/[slug]/domain/public-booking-result';

const success: PublicBookingResult = {
  ok: true,
  code: 'BOOKING_CREATED',
  appointmentId: 'apt-1',
  bookingToken: 'token-1',
  lookupCode: 'ABC123',
  isReplay: false,
};

const conflict: PublicBookingResult = {
  ok: false,
  code: 'SLOT_TAKEN',
  message: 'Este horário acabou de ser reservado.',
};

const internalError: PublicBookingResult = {
  ok: false,
  code: 'INTERNAL_ERROR',
  message: 'Não foi possível concluir a marcação.',
};

describe('confirmationReducer', () => {
  it('starts idle', () => {
    expect(INITIAL_CONFIRMATION_STATE).toEqual({ status: 'idle' });
  });

  it('idle -> submitting on SUBMIT_STARTED', () => {
    const next = confirmationReducer(INITIAL_CONFIRMATION_STATE, { type: 'SUBMIT_STARTED' });
    expect(next).toEqual({ status: 'submitting' });
  });

  it('submitting -> success on a BOOKING_CREATED result with token and lookup code', () => {
    const submitting: ConfirmationState = { status: 'submitting' };
    const next = confirmationReducer(submitting, { type: 'RESULT_RECEIVED', result: success });
    expect(next).toEqual({ status: 'success', bookingToken: 'token-1', lookupCode: 'ABC123' });
  });

  it('submitting -> idle when success arrives without a token or lookup code', () => {
    const submitting: ConfirmationState = { status: 'submitting' };
    const incomplete: PublicBookingResult = { ...success, bookingToken: null, lookupCode: null };
    const next = confirmationReducer(submitting, { type: 'RESULT_RECEIVED', result: incomplete });
    expect(next).toEqual({ status: 'idle' });
  });

  it('submitting -> conflict on SLOT_TAKEN', () => {
    const submitting: ConfirmationState = { status: 'submitting' };
    const next = confirmationReducer(submitting, { type: 'RESULT_RECEIVED', result: conflict });
    expect(next).toEqual({ status: 'conflict', message: conflict.message });
  });

  it('submitting -> error on any other error code', () => {
    const submitting: ConfirmationState = { status: 'submitting' };
    const next = confirmationReducer(submitting, { type: 'RESULT_RECEIVED', result: internalError });
    expect(next).toEqual({ status: 'error', message: internalError.message });
  });

  it('submitting -> error on REQUEST_FAILED', () => {
    const submitting: ConfirmationState = { status: 'submitting' };
    const next = confirmationReducer(submitting, {
      type: 'REQUEST_FAILED',
      message: 'Falha de rede.',
    });
    expect(next).toEqual({ status: 'error', message: 'Falha de rede.' });
  });

  it('submitting -> error on TIMED_OUT with a fixed message', () => {
    const submitting: ConfirmationState = { status: 'submitting' };
    const next = confirmationReducer(submitting, { type: 'TIMED_OUT' });
    expect(next.status).toBe('error');
    expect((next as { message: string }).message).toMatch(/demorou demasiado/);
  });

  it('a fresh SUBMIT_STARTED from an error state resets to submitting (retry)', () => {
    const errored: ConfirmationState = { status: 'error', message: 'oops' };
    const next = confirmationReducer(errored, { type: 'SUBMIT_STARTED' });
    expect(next).toEqual({ status: 'submitting' });
  });
});
