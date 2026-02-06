import { getDatabase } from '../db';
import type { Transaction, ParsedCSVRow } from '../../src/types';

export interface DuplicateMatch {
  csvRow: ParsedCSVRow;
  existingTransaction: Transaction;
  matchType: 'exact' | 'fuzzy';
  confidence: number;
}

export async function findDuplicates(
  accountId: number,
  rows: ParsedCSVRow[]
): Promise<DuplicateMatch[]> {
  const db = getDatabase();
  const duplicates: DuplicateMatch[] = [];

  // Get all existing transactions for this account
  const existingTransactions = db
    .prepare(
      `SELECT * FROM transactions WHERE account_id = ? ORDER BY date DESC`
    )
    .all(accountId) as Transaction[];

  for (const row of rows) {
    // Check for exact match on description or original_description
    const exactMatch = existingTransactions.find(
      (t) =>
        t.date === row.date &&
        Math.abs(t.amount - row.amount) < 0.01 &&
        (t.description === row.description ||
         t.original_description === row.original_description ||
         t.description === row.original_description ||
         t.original_description === row.description)
    );

    if (exactMatch) {
      duplicates.push({
        csvRow: row,
        existingTransaction: exactMatch,
        matchType: 'exact',
        confidence: 1.0,
      });
      continue;
    }

    // Check for fuzzy match (same date and amount, similar description)
    const fuzzyMatch = findFuzzyMatch(row, existingTransactions);
    if (fuzzyMatch) {
      duplicates.push(fuzzyMatch);
    }
  }

  console.log(`Found ${duplicates.length} potential duplicates out of ${rows.length} rows`);
  return duplicates;
}

function findFuzzyMatch(
  row: ParsedCSVRow,
  existingTransactions: Transaction[]
): DuplicateMatch | null {
  for (const transaction of existingTransactions) {
    // Must have same date and amount
    if (
      transaction.date !== row.date ||
      Math.abs(transaction.amount - row.amount) >= 0.01
    ) {
      continue;
    }

    // Calculate similarity for both description and original_description
    const descSimilarity = calculateSimilarity(
      row.description.toLowerCase(),
      transaction.description.toLowerCase()
    );

    const origDescSimilarity = transaction.original_description && row.original_description
      ? calculateSimilarity(
          row.original_description.toLowerCase(),
          transaction.original_description.toLowerCase()
        )
      : 0;

    // Also check cross-field similarity
    const crossSimilarity1 = transaction.original_description
      ? calculateSimilarity(
          row.description.toLowerCase(),
          transaction.original_description.toLowerCase()
        )
      : 0;

    const crossSimilarity2 = row.original_description
      ? calculateSimilarity(
          row.original_description.toLowerCase(),
          transaction.description.toLowerCase()
        )
      : 0;

    // Use the highest similarity score
    const maxSimilarity = Math.max(
      descSimilarity,
      origDescSimilarity,
      crossSimilarity1,
      crossSimilarity2
    );

    // If any description comparison is 70% similar, consider it a fuzzy match
    if (maxSimilarity >= 0.7) {
      return {
        csvRow: row,
        existingTransaction: transaction,
        matchType: 'fuzzy',
        confidence: maxSimilarity,
      };
    }
  }

  return null;
}

function calculateSimilarity(str1: string, str2: string): number {
  // Simple Levenshtein distance-based similarity
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

export function removeDuplicates(
  rows: ParsedCSVRow[],
  duplicates: DuplicateMatch[]
): ParsedCSVRow[] {
  const duplicateSet = new Set(
    duplicates.map((d) => JSON.stringify(d.csvRow))
  );

  return rows.filter((row) => !duplicateSet.has(JSON.stringify(row)));
}
