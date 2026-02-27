import { ipcMain } from 'electron';
import path from 'path';
import { detectFormat } from '../services/csv-detector';
import { parseCSV, validateParsedRows } from '../services/csv-parser';
import { findDuplicates, removeDuplicates } from '../services/duplicate-detector';
import { getDatabase } from '../db';
import { addLog } from './logs';
import type { CSVFormat, ParsedCSVRow, ImportPreview, ImportResult } from '../../src/types';

export function registerImportHandlers(): void {
  // Detect CSV format
  ipcMain.handle('import:detect-format', async (_, filePath: string) => {
    try {
      const filename = path.basename(filePath);
      addLog('info', 'Import', `Detecting format: ${filename}`);
      const format = await detectFormat(filePath);
      addLog('info', 'Import', `Format identified for ${filename}`);
      return format;
    } catch (error) {
      addLog('error', 'Import', `Format detection failed: ${(error as Error).message}`);
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
        const filename = path.basename(data.filePath);
        addLog('info', 'Import', `Parsing ${filename} for account ${data.accountId}...`);

        // Parse CSV
        const rows = await parseCSV(data.filePath, data.format);

        // Validate rows
        const { valid, invalid } = validateParsedRows(rows);

        // Check for duplicates
        const duplicates = await findDuplicates(data.accountId, valid);

        addLog('info', 'Import', `Preview: ${rows.length} rows — ${valid.length} valid, ${invalid.length} invalid, ${duplicates.length} duplicates`);

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
        addLog('error', 'Import', `Preview failed: ${(error as Error).message}`);
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
        addLog('info', 'Import', `Starting import: ${data.filename} (${data.rows.length} rows, account ${data.accountId})`);
        const db = getDatabase();

        let rowsToImport = data.rows;

        // Find duplicates if requested
        if (data.skipDuplicates) {
          const duplicates = await findDuplicates(data.accountId, data.rows);
          rowsToImport = removeDuplicates(data.rows, duplicates);
          addLog('info', 'Import', `Skipping ${duplicates.length} duplicates — ${rowsToImport.length} rows to import`);
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
              // Detect transfers by category name before deciding type
              const rawCategory = (row.category || '').toLowerCase().trim();
              const isTransfer = rawCategory.includes('transfer');

              // Determine transaction type
              const type = isTransfer ? 'transfer' : (row.amount < 0 ? 'expense' : 'income');
              const absAmount = Math.abs(row.amount);

              // Try to match category (skip for transfers — no category_id needed)
              let categoryId = null;
              if (!isTransfer && row.category) {
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
              addLog('error', 'Import', `Failed to insert row (${row.date} ${row.description}): ${(error as Error).message}`);
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

        addLog('success', 'Import', `Import complete: ${imported} imported, ${skipped} skipped (${dateRange.start} → ${dateRange.end})`);
        return result;
      } catch (error) {
        addLog('error', 'Import', `Import failed: ${(error as Error).message}`);
        throw error;
      }
    }
  );

  addLog('debug', 'Import', 'Import IPC handlers registered');
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
