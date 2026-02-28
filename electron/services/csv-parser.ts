import fs from 'fs';
import Papa from 'papaparse';
import { parse, format } from 'date-fns';
import { addLog } from '../ipc/logs';
import type { CSVFormat, ParsedCSVRow } from '../../src/types';

export async function parseCSV(
  filePath: string,
  csvFormat: CSVFormat
): Promise<ParsedCSVRow[]> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    const result = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    if (result.errors.length > 0) {
      addLog('warning', 'Import', `CSV parse warnings: ${result.errors.map(e => e.message).join('; ')}`);
    }

    const parsedRows: ParsedCSVRow[] = [];
    let rowErrors = 0;

    for (const row of result.data as any[]) {
      try {
        const parsedRow = parseRow(row, csvFormat);
        if (parsedRow) {
          parsedRows.push(parsedRow);
        }
      } catch (error) {
        rowErrors++;
        addLog('warning', 'Import', `Skipped row — ${(error as Error).message}`);
      }
    }

    if (rowErrors > 0) {
      addLog('warning', 'Import', `${rowErrors} rows skipped due to parse errors`);
    }
    addLog('debug', 'Import', `Parsed ${parsedRows.length} rows from CSV`);
    return parsedRows;
  } catch (error) {
    addLog('error', 'Import', `Failed to parse CSV file: ${(error as Error).message}`);
    throw new Error('Failed to parse CSV file');
  }
}

function parseRow(row: any, format: CSVFormat): ParsedCSVRow | null {
  // Extract values using format column mappings
  const dateStr = row[format.columns.date];
  const description = row[format.columns.description];
  const amountStr = row[format.columns.amount];
  const balanceStr = format.columns.balance ? row[format.columns.balance] : undefined;
  const category = format.columns.category ? row[format.columns.category] : undefined;
  const status = format.columns.status ? row[format.columns.status] : 'cleared';

  // Validate required fields
  if (!dateStr || !description || !amountStr) {
    return null;
  }

  // Check if transaction is pending (will be included but with no category)
  const isPending = description.toLowerCase().includes('pending') ||
                    category?.toLowerCase().includes('pending');

  if (isPending) {
    addLog('debug', 'Import', `Pending transaction (no category): ${description}`);
  }

  // Parse date
  let date: string;
  try {
    date = parseDateString(dateStr, format.dateFormat);
  } catch (error) {
    addLog('warning', 'Import', `Could not parse date "${dateStr}": ${(error as Error).message}`);
    return null;
  }

  // Parse amount
  let amount: number;
  try {
    amount = parseAmount(amountStr) * format.amountMultiplier;
  } catch (error) {
    addLog('warning', 'Import', `Could not parse amount "${amountStr}": ${(error as Error).message}`);
    return null;
  }

  // Parse balance (if available)
  let balance: number | undefined;
  if (balanceStr) {
    try {
      balance = parseAmount(balanceStr);
    } catch (error) {
      addLog('debug', 'Import', `Could not parse balance "${balanceStr}" — skipping`);
      balance = undefined;
    }
  }

  // Clean up description - take part before comma for simplified display
  const fullDescription = description.trim();
  const cleanDescription = fullDescription.includes(',')
    ? fullDescription.split(',')[0].trim()
    : fullDescription;

  return {
    date,
    description: cleanDescription,
    original_description: row['Original Description']?.trim() || fullDescription,
    amount: amount, // Keep the sign! Negative = expense, Positive = income
    balance,
    category: isPending ? undefined : category?.trim(), // No category for pending transactions
    status: normalizeStatus(status),
  };
}

function parseDateString(dateStr: string, _dateFormat: string): string {
  // Try various date formats
  const formats = [
    'yyyy-MM-dd',
    'MM/dd/yyyy',
    'M/d/yyyy',
    'MM-dd-yyyy',
    'yyyy/MM/dd',
    'dd/MM/yyyy',
  ];

  for (const fmt of formats) {
    try {
      const date = parse(dateStr, fmt, new Date());
      if (!isNaN(date.getTime())) {
        return format(date, 'yyyy-MM-dd');
      }
    } catch (error) {
      continue;
    }
  }

  throw new Error(`Unable to parse date: ${dateStr}`);
}

function parseAmount(amountStr: string): number {
  // Check if amount is in parentheses (accounting format for negative)
  const isParentheses = /^\(.*\)$/.test(amountStr.trim());

  // Remove currency symbols, commas, parentheses, and whitespace
  const cleaned = amountStr
    .replace(/[$,\s()]/g, '')
    .trim();

  let amount = parseFloat(cleaned);

  if (isNaN(amount)) {
    throw new Error(`Invalid amount: ${amountStr}`);
  }

  // If it was in parentheses, make it negative
  if (isParentheses) {
    amount = -Math.abs(amount);
  }

  return amount;
}

function normalizeStatus(status: string): 'pending' | 'cleared' | 'reconciled' {
  const normalized = status.toLowerCase().trim();

  if (normalized.includes('pending')) return 'pending';
  if (normalized.includes('reconciled')) return 'reconciled';
  return 'cleared';
}

export function validateParsedRows(rows: ParsedCSVRow[]): {
  valid: ParsedCSVRow[];
  invalid: Array<{ row: ParsedCSVRow; errors: string[] }>;
} {
  const valid: ParsedCSVRow[] = [];
  const invalid: Array<{ row: ParsedCSVRow; errors: string[] }> = [];

  for (const row of rows) {
    const errors: string[] = [];

    if (!row.date) errors.push('Missing date');
    if (!row.description) errors.push('Missing description');
    if (row.amount === 0 || isNaN(row.amount)) errors.push('Invalid amount');

    if (errors.length > 0) {
      invalid.push({ row, errors });
    } else {
      valid.push(row);
    }
  }

  return { valid, invalid };
}
