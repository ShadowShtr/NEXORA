import { describe, expect, it } from 'vitest';
import {
  buildFinanceTransactionsCsv,
  type FinanceTransactionRow,
} from '@/features/finance/domain/csv-export';

const TZ = 'Europe/Lisbon';

function row(overrides: Partial<FinanceTransactionRow> = {}): FinanceTransactionRow {
  return {
    completedAtIso: '2026-06-01T13:00:00.000Z', // 14:00 WEST -> 01/06/2026
    clientName: 'Ana Silva',
    serviceDescriptions: ['Verniz Gel'],
    paymentMethod: 'cash',
    paymentStatus: 'paid',
    amountCents: 1500,
    extrasCents: 0,
    discountCents: 0,
    ...overrides,
  };
}

describe('buildFinanceTransactionsCsv', () => {
  it('produces the exact expected CSV for a simple paid transaction', () => {
    const csv = buildFinanceTransactionsCsv([row()], TZ);
    const bom = String.fromCharCode(0xfeff);
    expect(csv).toBe(
      `${bom}Data,Cliente,Serviços,Método,Valor (EUR),Extras (EUR),Desconto (EUR)\r\n` +
        '01/06/2026,Ana Silva,Verniz Gel,Dinheiro,15.00,0.00,0.00\r\n',
    );
  });

  it('starts with the UTF-8 BOM', () => {
    const csv = buildFinanceTransactionsCsv([row()], TZ);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('labels mbway, pending and refunded correctly', () => {
    const csv = buildFinanceTransactionsCsv(
      [
        row({ paymentMethod: 'mbway' }),
        row({ paymentMethod: null, paymentStatus: 'pending' }),
        row({ paymentMethod: 'cash', paymentStatus: 'refunded' }),
      ],
      TZ,
    );
    const lines = csv.split('\r\n');
    expect(lines[1]).toContain(',MB WAY,');
    expect(lines[2]).toContain(',Pendente,');
    expect(lines[3]).toContain(',Estornado,');
  });

  it('joins multiple service descriptions with "; "', () => {
    const csv = buildFinanceTransactionsCsv(
      [row({ serviceDescriptions: ['Verniz Gel', 'Manicure'] })],
      TZ,
    );
    expect(csv).toContain('Verniz Gel; Manicure');
  });

  it('quotes a field containing a comma', () => {
    const csv = buildFinanceTransactionsCsv([row({ clientName: 'Silva, Ana' })], TZ);
    expect(csv).toContain('"Silva, Ana"');
  });

  it('escapes an embedded double quote by doubling it', () => {
    const csv = buildFinanceTransactionsCsv([row({ clientName: 'Ana "Rita" Silva' })], TZ);
    expect(csv).toContain('"Ana ""Rita"" Silva"');
  });

  describe('CSV injection protection', () => {
    it.each(["=cmd|'/c calc'!A1", '+1+1', '-2+3', '@SUM(A1:A2)', '\tmalicious'])(
      'guards a field starting with a formula-trigger character: %s',
      (dangerous) => {
        const csv = buildFinanceTransactionsCsv([row({ clientName: dangerous })], TZ);
        const lines = csv.split('\r\n');
        const clientField = lines[1]!.split(',')[1]!;
        expect(clientField.startsWith("'") || clientField.startsWith('"\'')).toBe(true);
      },
    );

    it('does not guard an ordinary field', () => {
      const csv = buildFinanceTransactionsCsv([row({ clientName: 'Ana Silva' })], TZ);
      expect(csv).toContain(',Ana Silva,');
    });
  });
});
