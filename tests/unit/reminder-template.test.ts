import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REMINDER_TEMPLATE,
  REMINDER_TEMPLATE_MAX_LENGTH,
  findDisallowedPlaceholders,
  renderReminderTemplate,
} from '@/features/reminders/domain/template';

describe('renderReminderTemplate', () => {
  it('substitutes all three placeholders', () => {
    const result = renderReminderTemplate(DEFAULT_REMINDER_TEMPLATE, {
      clientName: 'Ana',
      dateLabel: '24/07',
      timeLabel: '14:30',
    });
    expect(result).toBe('Olá Ana! Só a confirmar a sua marcação de 24/07 às 14:30.');
  });

  it('substitutes a placeholder used more than once', () => {
    const result = renderReminderTemplate('{{cliente}}, {{cliente}}!', {
      clientName: 'Ana',
      dateLabel: '24/07',
      timeLabel: '14:30',
    });
    expect(result).toBe('Ana, Ana!');
  });

  it('leaves unknown placeholders untouched rather than erroring', () => {
    const result = renderReminderTemplate('Olá {{cliente}}, código {{promo}}.', {
      clientName: 'Ana',
      dateLabel: '24/07',
      timeLabel: '14:30',
    });
    expect(result).toBe('Olá Ana, código {{promo}}.');
  });

  // A client name that itself contains "{{" must never be re-interpreted as a
  // placeholder in a second substitution pass — replaceAll's literal, single-pass
  // semantics per token already guarantee this, but it is worth pinning down as the
  // actual injection concern this task's "Injection" test requirement is about.
  it('treats a client name containing "{{data}}" as inert literal text, not a second substitution', () => {
    const result = renderReminderTemplate('Olá {{cliente}}!', {
      clientName: '{{data}}',
      dateLabel: '24/07',
      timeLabel: '14:30',
    });
    expect(result).toBe('Olá {{data}}!');
  });

  it('the default template stays within the max length', () => {
    expect(DEFAULT_REMINDER_TEMPLATE.length).toBeLessThanOrEqual(REMINDER_TEMPLATE_MAX_LENGTH);
  });
});

describe('findDisallowedPlaceholders', () => {
  it('finds nothing wrong with the default template', () => {
    expect(findDisallowedPlaceholders(DEFAULT_REMINDER_TEMPLATE)).toEqual([]);
  });

  it('finds nothing wrong with a template using no placeholders at all', () => {
    expect(findDisallowedPlaceholders('Mensagem simples sem placeholders.')).toEqual([]);
  });

  it('flags an unknown placeholder', () => {
    expect(findDisallowedPlaceholders('Código promo: {{promo}}')).toEqual(['{{promo}}']);
  });

  it('flags each distinct unknown placeholder only once even if repeated', () => {
    expect(findDisallowedPlaceholders('{{promo}} e {{promo}} outra vez, {{outro}}')).toEqual([
      '{{promo}}',
      '{{outro}}',
    ]);
  });

  it('does not flag a malformed/empty brace pair as a known placeholder', () => {
    expect(findDisallowedPlaceholders('Texto com {{}} vazio')).toEqual(['{{}}']);
  });
});
