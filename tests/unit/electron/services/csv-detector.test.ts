import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  default: { readFileSync: vi.fn() },
  readFileSync: vi.fn(),
}));

vi.mock('../../../../electron/ipc/logs', () => ({ addLog: vi.fn() }));

import fs from 'fs';
import { detectFormat, getKnownFormats } from '../../../../electron/services/csv-detector';

function mockFile(content: string) {
  vi.mocked(fs.readFileSync).mockReturnValue(content as unknown as Buffer);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getKnownFormats', () => {
  it('returns at least the USAA format', () => {
    const formats = getKnownFormats();
    expect(formats.some((f) => f.institution === 'USAA')).toBe(true);
  });
});

describe('detectFormat', () => {
  it('matches USAA format when exact headers present', async () => {
    mockFile('Date,Description,Amount,Category,Status\n2025-01-01,Coffee,-5,Dining,Posted');
    const fmt = await detectFormat('/fake.csv');
    expect(fmt?.institution).toBe('USAA');
  });

  it('matches USAA format case-insensitively', async () => {
    mockFile('date,description,amount,category,status\n2025-01-01,Coffee,-5,Dining,Posted');
    const fmt = await detectFormat('/fake.csv');
    // Case-insensitive match should still return USAA (columns matched by .toLowerCase())
    expect(fmt).not.toBeNull();
  });

  it('auto-detects generic format when no known format matches but core columns present', async () => {
    mockFile('transaction_date,payee,transaction_amount\n2025-01-01,Coffee,-5');
    const fmt = await detectFormat('/fake.csv');
    expect(fmt?.name).toContain('Generic');
    expect(fmt?.institution).toBe('Unknown');
  });

  it('returns null when required columns are missing', async () => {
    mockFile('product,quantity,price\nApple,2,1.50');
    const fmt = await detectFormat('/fake.csv');
    expect(fmt).toBeNull();
  });

  it('returns null for empty or short file', async () => {
    mockFile('');
    const fmt = await detectFormat('/fake.csv');
    expect(fmt).toBeNull();
  });
});
