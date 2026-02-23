import fs from 'fs';
import Papa from 'papaparse';
// Define known CSV formats
const KNOWN_FORMATS = [
    {
        name: 'USAA',
        institution: 'USAA',
        columns: {
            date: 'Date',
            description: 'Description',
            amount: 'Amount',
            category: 'Category',
            status: 'Status',
        },
        dateFormat: 'YYYY-MM-DD',
        amountMultiplier: 1,
    },
    // Add more formats as needed
    {
        name: 'Generic',
        institution: 'Generic',
        columns: {
            date: 'date',
            description: 'description',
            amount: 'amount',
        },
        dateFormat: 'YYYY-MM-DD',
        amountMultiplier: 1,
    },
];
export async function detectFormat(filePath) {
    try {
        // Read first few lines of the file
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').slice(0, 10);
        if (lines.length < 2) {
            return null;
        }
        // Parse CSV header and sample rows
        const result = Papa.parse(content, {
            header: true,
            preview: 5,
            skipEmptyLines: true,
        });
        if (!result.data || result.data.length === 0) {
            return null;
        }
        const headers = Object.keys(result.data[0]);
        console.log('CSV Headers detected:', headers);
        // Try to match against known formats
        for (const format of KNOWN_FORMATS) {
            const requiredColumns = [
                format.columns.date,
                format.columns.description,
                format.columns.amount,
            ];
            // Check if all required columns exist (case-insensitive)
            const matchCount = requiredColumns.filter((col) => headers.some((h) => h.toLowerCase() === col.toLowerCase())).length;
            if (matchCount === requiredColumns.length) {
                console.log(`Detected format: ${format.name}`);
                return format;
            }
        }
        // If no exact match, try partial matches
        const hasDate = headers.some((h) => /date/i.test(h));
        const hasDescription = headers.some((h) => /description|memo|payee/i.test(h));
        const hasAmount = headers.some((h) => /amount|value|sum/i.test(h));
        if (hasDate && hasDescription && hasAmount) {
            // Return generic format with detected columns
            return {
                name: 'Generic (Auto-detected)',
                institution: 'Unknown',
                columns: {
                    date: headers.find((h) => /date/i.test(h)) || 'date',
                    description: headers.find((h) => /description|memo|payee/i.test(h)) || 'description',
                    amount: headers.find((h) => /amount|value|sum/i.test(h)) || 'amount',
                },
                dateFormat: 'YYYY-MM-DD',
                amountMultiplier: 1,
            };
        }
        console.log('No matching format found');
        return null;
    }
    catch (error) {
        console.error('Error detecting CSV format:', error);
        return null;
    }
}
export function getKnownFormats() {
    return KNOWN_FORMATS;
}
