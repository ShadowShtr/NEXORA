import { describe, expect, it } from 'vitest';
import {
  buildWhatsappDeepLink,
  buildAppointmentReminderMessage,
  APPOINTMENT_STATUS_LABELS,
} from '@/features/appointments/domain/appointment-card';

describe('buildWhatsappDeepLink', () => {
  it('strips the leading + and URL-encodes the message', () => {
    const url = buildWhatsappDeepLink('+351911111111', 'Olá! Test message.');
    expect(url).toBe('https://wa.me/351911111111?text=Ol%C3%A1!%20Test%20message.');
  });
});

describe('buildAppointmentReminderMessage', () => {
  it('includes the client name and time', () => {
    const message = buildAppointmentReminderMessage('Ana', '14:30');
    expect(message).toContain('Ana');
    expect(message).toContain('14:30');
  });
});

describe('APPOINTMENT_STATUS_LABELS', () => {
  it('has a pt-PT label for every appointment_status enum value', () => {
    const enumValues = ['confirmed', 'presence_confirmed', 'completed', 'cancelled', 'no_show'];
    for (const value of enumValues) {
      expect(APPOINTMENT_STATUS_LABELS).toHaveProperty(value);
    }
  });
});
