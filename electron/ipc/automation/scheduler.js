import * as cron from 'node-cron';
import { getDatabase } from '../../db';
import { getAutomationSettings } from '../../db/queries/automation-settings';
import { playRecording } from './index';
export const INTERVAL_TO_CRON = {
    hourly: '0 * * * *',
    every_4h: '0 */4 * * *',
    every_6h: '0 */6 * * *',
    every_12h: '0 */12 * * *',
    daily: '0 6 * * *',
    weekly: '0 6 * * 1',
};
export const CRON_TO_INTERVAL = Object.fromEntries(Object.entries(INTERVAL_TO_CRON).map(([k, v]) => [v, k]));
let task = null;
let isRunning = false;
let currentRecordingName = null;
let lastRunAt = null;
let activeCronExpr = null;
export function initScheduler() {
    const db = getDatabase();
    const settings = getAutomationSettings(db);
    if (settings.schedule_enabled && settings.schedule_cron) {
        console.log('[Scheduler] Initializing from DB settings:', settings.schedule_cron);
        start(settings.schedule_cron);
    }
}
export function start(cronExpr) {
    stop();
    if (!cron.validate(cronExpr)) {
        console.warn('[Scheduler] Invalid cron expression:', cronExpr);
        return;
    }
    activeCronExpr = cronExpr;
    task = cron.schedule(cronExpr, () => { runAll().catch(console.error); });
    console.log('[Scheduler] Started with cron:', cronExpr);
}
export function stop() {
    if (task) {
        task.destroy();
        task = null;
        activeCronExpr = null;
        console.log('[Scheduler] Stopped');
    }
}
export function getStatus() {
    const db = getDatabase();
    const settings = getAutomationSettings(db);
    return {
        isRunning,
        currentRecordingName,
        lastRunAt,
        cronExpr: activeCronExpr,
        interval: activeCronExpr ? (CRON_TO_INTERVAL[activeCronExpr] ?? null) : null,
        enabled: settings.schedule_enabled,
    };
}
export async function runAllNow() {
    await runAll();
}
async function runAll() {
    if (isRunning) {
        console.log('[Scheduler] Already running, skipping');
        return;
    }
    isRunning = true;
    console.log('[Scheduler] Starting sequential run of all recordings');
    try {
        const db = getDatabase();
        const recipes = db.prepare('SELECT id, name FROM export_recipes ORDER BY name').all();
        console.log(`[Scheduler] Found ${recipes.length} recordings to run`);
        for (const recipe of recipes) {
            currentRecordingName = recipe.name;
            console.log(`[Scheduler] Running: ${recipe.name} (id=${recipe.id})`);
            try {
                await playRecording(String(recipe.id));
            }
            catch (e) {
                console.error(`[Scheduler] Recording "${recipe.name}" failed:`, e);
                // Individual failures don't stop the sequence
            }
            await sleep(2000);
        }
        lastRunAt = new Date().toISOString();
        console.log('[Scheduler] All recordings complete. Last run:', lastRunAt);
    }
    finally {
        currentRecordingName = null;
        isRunning = false;
    }
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
