import { describe, expect, it, vi, afterEach } from 'vitest';
import { NoopEmailProvider } from '@/lib/email/noop-provider';
import { ResendEmailProvider } from '@/lib/email/resend-provider';
import { buildBookingConfirmationEmail } from '@/lib/email/booking-confirmation-template';
import type { EmailMessage } from '@/lib/email/provider';

describe('NoopEmailProvider (booking não depende de entrega)', () => {
  it('always succeeds without making any network call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const provider = new NoopEmailProvider();
    const result = await provider.send({
      to: 'client@example.test',
      subject: 'Test',
      html: '<p>Test</p>',
      text: 'Test',
    });
    expect(result).toEqual({ ok: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('ResendEmailProvider', () => {
  const message: EmailMessage = {
    to: 'client@example.test',
    subject: 'Marcação confirmada',
    html: '<p>Hi</p>',
    text: 'Hi',
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the message with the configured from address (mock provider)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new ResendEmailProvider('re_test_key', 'no-reply@nexora.pt');
    const result = await provider.send(message);

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({ from: 'no-reply@nexora.pt', to: message.to });
    expect(options.headers.Authorization).toBe('Bearer re_test_key');
  });

  it('never leaks the API key into the returned result on failure (redaction)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 })),
    );

    const provider = new ResendEmailProvider('re_super_secret_key', 'no-reply@nexora.pt');
    const result = await provider.send(message);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toContain('re_super_secret_key');
    }
  });

  it('does not retry a 4xx (permanent) failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('bad request', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new ResendEmailProvider('re_test_key', 'no-reply@nexora.pt');
    const result = await provider.send(message);

    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a 5xx (transient) failure up to the configured attempt limit, then reports failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('server error', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new ResendEmailProvider('re_test_key', 'no-reply@nexora.pt');
    const result = await provider.send(message);

    expect(result.ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 10_000);

  it('succeeds if a later retry attempt returns 200 after earlier 5xx responses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('server error', { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new ResendEmailProvider('re_test_key', 'no-reply@nexora.pt');
    const result = await provider.send(message);

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on a network-level failure (fetch rejects)', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const provider = new ResendEmailProvider('re_test_key', 'no-reply@nexora.pt');
    const result = await provider.send(message);

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('buildBookingConfirmationEmail', () => {
  it('renders both a text and an html body with the booking details', () => {
    const message = buildBookingConfirmationEmail({
      to: 'client@example.test',
      businessName: 'Joana Nails',
      startAtIso: '2026-06-15T09:00:00.000Z',
      timezone: 'Europe/Lisbon',
      items: [{ description: 'Verniz Gel', unitPriceCents: 2500 }],
      totalCents: 2500,
      bookingUrl: 'https://nexora.pt/marcacao/abc123',
      lookupCode: 'AB23CD45',
    });

    expect(message.to).toBe('client@example.test');
    expect(message.subject).toContain('Joana Nails');
    expect(message.text).toContain('Verniz Gel');
    expect(message.text).toContain('25,00');
    expect(message.text).toContain('https://nexora.pt/marcacao/abc123');
    expect(message.text).toContain('AB23CD45');
    expect(message.html).toContain('Verniz Gel');
    expect(message.html).toContain('href="https://nexora.pt/marcacao/abc123"');
    expect(message.html).toContain('AB23CD45');
  });

  it('escapes HTML-significant characters in business/item names', () => {
    const message = buildBookingConfirmationEmail({
      to: 'client@example.test',
      businessName: '<script>alert(1)</script>',
      startAtIso: '2026-06-15T09:00:00.000Z',
      timezone: 'Europe/Lisbon',
      items: [],
      totalCents: 0,
      bookingUrl: 'https://nexora.pt/marcacao/abc123',
      lookupCode: 'AB23CD45',
    });

    expect(message.html).not.toContain('<script>alert(1)</script>');
    expect(message.html).toContain('&lt;script&gt;');
  });
});
