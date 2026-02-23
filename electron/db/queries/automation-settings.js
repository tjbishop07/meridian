/**
 * Get all automation settings as a typed object
 */
export function getAutomationSettings(db) {
    const rows = db.prepare('SELECT key, value FROM automation_settings').all();
    const settings = {};
    for (const row of rows) {
        settings[row.key] = row.value;
    }
    return {
        vision_provider: (settings.vision_provider || 'none'),
        claude_api_key: settings.claude_api_key || '',
        claude_model: settings.claude_model || 'claude-sonnet-4-5-20250929',
        retry_attempts: parseInt(settings.retry_attempts || '3', 10),
        retry_delay_ms: parseInt(settings.retry_delay_ms || '2000', 10),
        schedule_enabled: settings.schedule_enabled === 'true',
        schedule_cron: settings.schedule_cron || '0 6 * * *',
        scraping_prompt: settings.scraping_prompt || '',
        prompt_welcome: settings.prompt_welcome || '',
    };
}
/**
 * Get a single automation setting by key
 */
export function getAutomationSetting(db, key) {
    const row = db.prepare('SELECT value FROM automation_settings WHERE key = ?').get(key);
    return row ? row.value : null;
}
/**
 * Set a single automation setting
 */
export function setAutomationSetting(db, key, value) {
    db.prepare(`INSERT INTO automation_settings (key, value, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`).run(key, value, value);
}
/**
 * Update multiple automation settings at once
 */
export function updateAutomationSettings(db, settings) {
    const transaction = db.transaction(() => {
        for (const [key, value] of Object.entries(settings)) {
            if (value !== undefined) {
                setAutomationSetting(db, key, value);
            }
        }
    });
    transaction();
}
