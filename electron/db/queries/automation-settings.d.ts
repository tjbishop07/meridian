import type Database from 'better-sqlite3';
export interface AutomationSettings {
    vision_provider: 'claude' | 'none';
    claude_api_key: string;
    claude_model?: string;
    retry_attempts: number;
    retry_delay_ms: number;
    schedule_enabled: boolean;
    schedule_cron: string;
    scraping_prompt?: string;
    prompt_welcome?: string;
}
/**
 * Get all automation settings as a typed object
 */
export declare function getAutomationSettings(db: Database.Database): AutomationSettings;
/**
 * Get a single automation setting by key
 */
export declare function getAutomationSetting(db: Database.Database, key: string): string | null;
/**
 * Set a single automation setting
 */
export declare function setAutomationSetting(db: Database.Database, key: string, value: string): void;
/**
 * Update multiple automation settings at once
 */
export declare function updateAutomationSettings(db: Database.Database, settings: Partial<Record<keyof AutomationSettings, string>>): void;
