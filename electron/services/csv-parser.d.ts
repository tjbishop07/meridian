import type { CSVFormat, ParsedCSVRow } from '../../src/types';
export declare function parseCSV(filePath: string, csvFormat: CSVFormat): Promise<ParsedCSVRow[]>;
export declare function validateParsedRows(rows: ParsedCSVRow[]): {
    valid: ParsedCSVRow[];
    invalid: Array<{
        row: ParsedCSVRow;
        errors: string[];
    }>;
};
