import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  default: { readFileSync: vi.fn() },
  readFileSync: vi.fn(),
}));

vi.mock('../../../../electron/ipc/logs', () => ({ addLog: vi.fn() }));

import fs from 'fs';
import { parseCSV } from '../../../../electron/services/csv-parser';
import type { CSVFormat } from '../../../../src/types';

const USAA_FORMAT: CSVFormat = {
  name: 'USAA',
  institution: 'USAA',
  columns: {
    date: 'Date',
    description: 'Description',
    amount: 'Amount',
    category: 'Category',
    status: 'Status',
  },
  dateFormat: 'yyyy-MM-dd',
  amountMultiplier: 1,
};

function mockCsv(content: string) {
  vi.mocked(fs.readFileSync).mockReturnValue(content as unknown as Buffer);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseCSV — date formats', () => {
  const testCases: [string, string, string][] = [
    ['yyyy-MM-dd', '2025-01-15', '2025-01-15'],
    ['MM/dd/yyyy', '01/15/2025', '2025-01-15'],
    ['M/d/yyyy', '1/5/2025', '2025-01-05'],
    ['MM-dd-yyyy', '01-15-2025', '2025-01-15'],
    ['yyyy/MM/dd', '2025/01/15', '2025-01-15'],
    ['dd/MM/yyyy', '15/01/2025', '2025-01-15'],
  ];

  for (const [label, rawDate, expected] of testCases) {
    it(`parses ${label} → ${expected}`, async () => {
      mockCsv(`Date,Description,Amount,Category,Status\n${rawDate},Coffee,-5.00,Dining,Posted`);
      const rows = await parseCSV('/fake.csv', USAA_FORMAT);
      expect(rows[0].date).toBe(expected);
    });
  }
});

describe('parseCSV — amount parsing', () => {
  it('parses negative amounts directly', async () => {
    mockCsv('Date,Description,Amount,Category,Status\n2025-01-15,Coffee,-12.50,Dining,Posted');
    const [row] = await parseCSV('/fake.csv', USAA_FORMAT);
    expect(row.amount).toBe(-12.5);
  });

  it('treats parentheses as negative (accounting format)', async () => {
    mockCsv('Date,Description,Amount,Category,Status\n2025-01-15,Return,(25.00),Shopping,Posted');
    const [row] = await parseCSV('/fake.csv', USAA_FORMAT);
    expect(row.amount).toBe(-25);
  });

  it('applies amountMultiplier', async () => {
    mockCsv('Date,Description,Amount,Category,Status\n2025-01-15,Paycheck,3000.00,Income,Posted');
    const format: CSVFormat = { ...USAA_FORMAT, amountMultiplier: -1 };
    const [row] = await parseCSV('/fake.csv', format);
    expect(row.amount).toBe(-3000);
  });

  it('strips currency symbols and commas from amount', async () => {
    mockCsv('Date,Description,Amount,Category,Status\n2025-01-15,Rent,"$1,200.00",Housing,Posted');
    const [row] = await parseCSV('/fake.csv', USAA_FORMAT);
    expect(row.amount).toBe(1200);
  });
});

describe('parseCSV — description handling', () => {
  it('takes only the part before a comma in the description', async () => {
    mockCsv('Date,Description,Amount,Category,Status\n2025-01-15,"STARBUCKS #1234, AUSTIN TX",-5.00,Dining,Posted');
    const [row] = await parseCSV('/fake.csv', USAA_FORMAT);
    expect(row.description).toBe('STARBUCKS #1234');
  });

  it('keeps full description when no comma present', async () => {
    mockCsv('Date,Description,Amount,Category,Status\n2025-01-15,Netflix,-15.99,Subscriptions,Posted');
    const [row] = await parseCSV('/fake.csv', USAA_FORMAT);
    expect(row.description).toBe('Netflix');
  });
});

describe('parseCSV — pending transactions', () => {
  it('strips category for pending transactions', async () => {
    mockCsv('Date,Description,Amount,Category,Status\n2025-01-15,Pending: Starbucks,-5.00,Dining,Pending');
    const [row] = await parseCSV('/fake.csv', USAA_FORMAT);
    expect(row.category).toBeUndefined();
  });
});

describe('parseCSV — status normalization', () => {
  it('maps "Posted" to "cleared"', async () => {
    mockCsv('Date,Description,Amount,Category,Status\n2025-01-15,Coffee,-5.00,Dining,Posted');
    const [row] = await parseCSV('/fake.csv', USAA_FORMAT);
    expect(row.status).toBe('cleared');
  });

  it('maps "Pending" to "pending"', async () => {
    mockCsv('Date,Description,Amount,Category,Status\n2025-01-15,Coffee,-5.00,Dining,Pending');
    const [row] = await parseCSV('/fake.csv', USAA_FORMAT);
    expect(row.status).toBe('pending');
  });
});

describe('parseCSV — skips invalid rows', () => {
  it('skips rows missing required fields', async () => {
    mockCsv('Date,Description,Amount,Category,Status\n2025-01-15,,-5.00,,Posted');
    const rows = await parseCSV('/fake.csv', USAA_FORMAT);
    expect(rows).toHaveLength(0);
  });

  it('skips rows with unparseable dates', async () => {
    mockCsv('Date,Description,Amount,Category,Status\nnot-a-date,Coffee,-5.00,Dining,Posted');
    const rows = await parseCSV('/fake.csv', USAA_FORMAT);
    expect(rows).toHaveLength(0);
  });
});
