import fs from 'fs';
import Papa from 'papaparse';
import { parse, format } from 'date-fns';
export async function parseCSV(filePath, csvFormat) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const result = Papa.parse(content, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(),
        });
        if (result.errors.length > 0) {
            console.error('CSV parse errors:', result.errors);
        }
        const parsedRows = [];
        for (const row of result.data) {
            try {
                const parsedRow = parseRow(row, csvFormat);
                if (parsedRow) {
                    parsedRows.push(parsedRow);
                }
            }
            catch (error) {
                console.error('Error parsing row:', error, row);
            }
        }
        console.log(`Parsed ${parsedRows.length} rows from CSV`);
        return parsedRows;
    }
    catch (error) {
        console.error('Error parsing CSV file:', error);
        throw new Error('Failed to parse CSV file');
    }
}
function parseRow(row, format) {
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
        console.log('[CSV Parser] Found pending transaction (will import with no category):', description);
    }
    // Parse date
    let date;
    try {
        date = parseDateString(dateStr, format.dateFormat);
    }
    catch (error) {
        console.error('Error parsing date:', dateStr, error);
        return null;
    }
    // Parse amount
    let amount;
    try {
        amount = parseAmount(amountStr) * format.amountMultiplier;
    }
    catch (error) {
        console.error('Error parsing amount:', amountStr, error);
        return null;
    }
    // Parse balance (if available)
    let balance;
    if (balanceStr) {
        try {
            balance = parseAmount(balanceStr);
        }
        catch (error) {
            console.warn('Error parsing balance:', balanceStr, error);
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
        amount: amount,
        balance,
        category: isPending ? undefined : category?.trim(),
        status: normalizeStatus(status),
    };
}
function parseDateString(dateStr, dateFormat) {
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
        }
        catch (error) {
            continue;
        }
    }
    throw new Error(`Unable to parse date: ${dateStr}`);
}
function parseAmount(amountStr) {
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
function normalizeStatus(status) {
    const normalized = status.toLowerCase().trim();
    if (normalized.includes('pending'))
        return 'pending';
    if (normalized.includes('reconciled'))
        return 'reconciled';
    return 'cleared';
}
export function validateParsedRows(rows) {
    const valid = [];
    const invalid = [];
    for (const row of rows) {
        const errors = [];
        if (!row.date)
            errors.push('Missing date');
        if (!row.description)
            errors.push('Missing description');
        if (row.amount === 0 || isNaN(row.amount))
            errors.push('Invalid amount');
        if (errors.length > 0) {
            invalid.push({ row, errors });
        }
        else {
            valid.push(row);
        }
    }
    return { valid, invalid };
}
