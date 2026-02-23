import type { CSVFormat } from '../../src/types';
export declare function detectFormat(filePath: string): Promise<CSVFormat | null>;
export declare function getKnownFormats(): CSVFormat[];
