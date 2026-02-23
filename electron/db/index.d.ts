import Database from 'better-sqlite3';
export declare function getDatabase(): Database.Database;
export declare function initDatabase(): Database.Database;
export declare function closeDatabase(): void;
export declare function transaction<T>(fn: () => T): T;
export declare function batchInsert<T extends Record<string, any>>(table: string, rows: T[]): number;
