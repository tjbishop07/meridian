import { ipcMain } from 'electron';
import { detectFormat } from '../services/csv-detector';
import { parseCSV, validateParsedRows } from '../services/csv-parser';
import { findDuplicates, removeDuplicates } from '../services/duplicate-detector';
import { getDatabase } from '../db';
import type { CSVFormat, ParsedCSVRow, ImportPreview, ImportResult } from '../../src/types';

export function registerImportHandlers(): void {
  // Detect CSV format
  ipcMain.handle('import:detect-format', async (_, filePath: string) => {
    try {
      console.log('Detecting format for:', filePath);
      const format = await detectFormat(filePath);
      return format;
    } catch (error) {
      console.error('Error detecting format:', error);
      throw error;
    }
  });

  // Preview import with duplicate detection
  ipcMain.handle(
    'import:preview',
    async (
      _,
      data: { filePath: string; accountId: number; format: CSVFormat }
    ) => {
      try {
        console.log('Previewing import for account:', data.accountId);

        // Parse CSV
        const rows = await parseCSV(data.filePath, data.format);
        console.log(`Parsed ${rows.length} rows`);

        // Validate rows
        const { valid, invalid } = validateParsedRows(rows);
        console.log(`Valid: ${valid.length}, Invalid: ${invalid.length}`);

        // Check for duplicates
        const duplicates = await findDuplicates(data.accountId, valid);
        console.log(`Found ${duplicates.length} duplicates`);

        const preview: ImportPreview = {
          format: data.format,
          rows: valid,
          duplicates,
          errors: invalid.map((item, index) => ({
            row: index,
            error: item.errors.join(', '),
          })),
        };

        return preview;
      } catch (error) {
        console.error('Error previewing import:', error);
        throw error;
      }
    }
  );

  // Execute import
  ipcMain.handle(
    'import:execute',
    async (
      _,
      data: {
        accountId: number;
        rows: ParsedCSVRow[];
        skipDuplicates: boolean;
        filename: string;
        format: string;
      }
    ) => {
      try {
        console.log('Executing import for account:', data.accountId);
        const db = getDatabase();

        let rowsToImport = data.rows;

        // Find duplicates if requested
        if (data.skipDuplicates) {
          const duplicates = await findDuplicates(data.accountId, data.rows);
          rowsToImport = removeDuplicates(data.rows, duplicates);
          console.log(
            `Skipping ${duplicates.length} duplicates, importing ${rowsToImport.length} rows`
          );
        }

        // Map categories
        const categories = db
          .prepare('SELECT id, name, type FROM categories')
          .all() as Array<{ id: number; name: string; type: string }>;

        const categoryMap = new Map(
          categories.map((c) => [c.name.toLowerCase(), c.id])
        );

        // Find default income category
        const incomeCategory = categories.find(
          c => c.type === 'income' && (c.name.toLowerCase() === 'income' || c.name.toLowerCase().includes('income'))
        );

        // Prepare insert statement
        const insertStmt = db.prepare(`
          INSERT OR IGNORE INTO transactions (
            account_id, category_id, date, description, original_description,
            amount, balance, type, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Insert transactions in a transaction
        const insertMany = db.transaction((rows: ParsedCSVRow[]) => {
          let imported = 0;
          let skipped = 0;

          for (const row of rows) {
            try {
              // Determine transaction type (negative amounts are expenses)
              const type = row.amount < 0 ? 'expense' : 'income';
              const absAmount = Math.abs(row.amount);

              // Try to match category
              let categoryId = null;
              if (row.category) {
                const categoryName = row.category.toLowerCase();
                categoryId = categoryMap.get(categoryName) || null;
              }

              // Auto-assign income category for positive amounts if no category was matched
              if (type === 'income' && !categoryId && incomeCategory) {
                categoryId = incomeCategory.id;
              }

              const result = insertStmt.run(
                data.accountId,
                categoryId,
                row.date,
                row.description,
                row.original_description,
                absAmount,
                row.balance || null,
                type,
                row.status || 'cleared'
              );

              if (result.changes > 0) {
                imported++;
              } else {
                skipped++; // Duplicate (UNIQUE constraint)
              }
            } catch (error) {
              console.error('Error inserting row:', error, row);
              skipped++;
            }
          }

          return { imported, skipped };
        });

        const { imported, skipped } = insertMany(rowsToImport);

        // Record import history
        const dateRange = getDateRange(rowsToImport);
        const historyStmt = db.prepare(`
          INSERT INTO import_history (
            filename, account_id, format, rows_imported, rows_skipped,
            date_range_start, date_range_end
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const historyResult = historyStmt.run(
          data.filename,
          data.accountId,
          data.format,
          imported,
          skipped,
          dateRange.start,
          dateRange.end
        );

        const result: ImportResult = {
          imported,
          skipped,
          errors: 0,
          history_id: historyResult.lastInsertRowid as number,
        };

        console.log('Import completed:', result);
        return result;
      } catch (error) {
        console.error('Error executing import:', error);
        throw error;
      }
    }
  );

  console.log('Import IPC handlers registered');
}

function getDateRange(rows: ParsedCSVRow[]): { start: string; end: string } {
  if (rows.length === 0) {
    const today = new Date().toISOString().split('T')[0];
    return { start: today, end: today };
  }

  const dates = rows.map((r) => r.date).sort();
  return {
    start: dates[0],
    end: dates[dates.length - 1],
  };
}
