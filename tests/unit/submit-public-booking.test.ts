import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitPublicBooking } from '@/app/b/[slug]/domain/submit-public-booking';

const input = {
  registration: { name: 'Cliente A', phone: '+351911111111' },
  selectedServiceIds: ['svc-1'],
  selectedPackageId: null,
  startAtIso: '2026-08-01T10:00:00.000Z',
  idempotencyKey: 'a'.repeat(64),
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('submitPublicBooking', () => {
  it('returns a BOOKING_CREATED result for HTTP 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            ok: true,
            code: 'BOOKING_CREATED',
            appointmentId: 'apt-1',
            bookingToken: 'token-1',
            lookupCode: 'ABC123',
            isReplay: false,
          },
          200,
        ),
      ),
    );

    const result = await submitPublicBooking('acme', input);
    expect(result).toEqual({
      ok: true,
      code: 'BOOKING_CREATED',
      appointmentId: 'apt-1',
      bookingToken: 'token-1',
      lookupCode: 'ABC123',
      isReplay: false,
    });
  });

  it('returns a SLOT_TAKEN result for HTTP 409, not a thrown error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { ok: false, code: 'SLOT_TAKEN', message: 'Este horário acabou de ser reservado.' },
            409,
          ),
        ),
    );

    const result = await submitPublicBooking('acme', input);
    expect(result).toEqual({
      ok: false,
      code: 'SLOT_TAKEN',
      message: 'Este horário acabou de ser reservado.',
    });
  });

  it('rejects an empty response body instead of hanging', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));

    await expect(submitPublicBooking('acme', input)).rejects.toThrow(
      /Unrecognized booking response/,
    );
  });

  it('rejects a non-JSON response body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>proxy error</html>', { status: 502 })),
    );

    await expect(submitPublicBooking('acme', input)).rejects.toThrow(/Invalid booking response/);
  });

  it('rejects a JSON body that does not match the discriminated contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ unexpected: true }, 200)));

    await expect(submitPublicBooking('acme', input)).rejects.toThrow(
      /Unrecognized booking response/,
    );
  });

  it('propagates an AbortError when the signal is aborted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.reject(new DOMException('Aborted', 'AbortError'))),
    );

    const controller = new AbortController();
    controller.abort();

    await expect(submitPublicBooking('acme', input, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('encodes the slug in the request URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ ok: false, code: 'NOT_FOUND', message: 'Negócio não encontrado.' }, 404),
      );
    vi.stubGlobal('fetch', fetchMock);

    await submitPublicBooking('slug with space', input);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('/api/public/business/slug%20with%20space/bookings');
  });
});
