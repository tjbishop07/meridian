import * as cron from 'node-cron';
import { getDatabase } from '../../db';
import { getAutomationSettings, setAutomationSetting } from '../../db/queries/automation-settings';
import { addLog } from '../logs';
import { playRecording } from './index';

export const INTERVAL_TO_CRON: Record<string, string> = {
  hourly:    '0 * * * *',
  every_4h:  '0 */4 * * *',
  every_6h:  '0 */6 * * *',
  every_12h: '0 */12 * * *',
  daily:     '0 6 * * *',
  weekly:    '0 6 * * 1',
};

export const CRON_TO_INTERVAL: Record<string, string> = Object.fromEntries(
  Object.entries(INTERVAL_TO_CRON).map(([k, v]) => [v, k])
);

let task: cron.ScheduledTask | null = null;
let isRunning = false;
let currentRecordingName: string | null = null;
let lastRunAt: string | null = null;
let activeCronExpr: string | null = null;

export function initScheduler(): void {
  const db = getDatabase();
  const settings = getAutomationSettings(db);
  if (settings.schedule_enabled && settings.schedule_cron) {
    addLog('info', 'Scheduler', `Schedule loaded from settings: ${settings.schedule_cron}`);
    start(settings.schedule_cron);
  }
}

export function start(cronExpr: string): void {
  stop();
  if (!cron.validate(cronExpr)) {
    addLog('error', 'Scheduler', `Invalid cron expression: ${cronExpr}`);
    return;
  }
  activeCronExpr = cronExpr;
  task = cron.schedule(cronExpr, () => { runAll().catch(console.error); });
  addLog('info', 'Scheduler', `Started (cron: ${cronExpr})`);
}

export function stop(): void {
  if (task) {
    task.destroy();
    task = null;
    activeCronExpr = null;
    addLog('info', 'Scheduler', 'Schedule stopped');
  }
}

export interface ScheduleStatus {
  isRunning: boolean;
  currentRecordingName: string | null;
  lastRunAt: string | null;
  cronExpr: string | null;
  interval: string | null;
  enabled: boolean;
}

export function getStatus(): ScheduleStatus {
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

export async function runAllNow(): Promise<void> {
  await runAll();
}

async function runAll(): Promise<void> {
  if (isRunning) {
    addLog('warning', 'Scheduler', 'Run skipped — already in progress');
    return;
  }
  isRunning = true;

  try {
    const db = getDatabase();
    const recipes = db.prepare('SELECT id, name FROM export_recipes ORDER BY name').all() as Array<{ id: number; name: string }>;

    addLog('info', 'Scheduler', `Starting run: ${recipes.length} recording${recipes.length !== 1 ? 's' : ''}`);

    for (const recipe of recipes) {
      currentRecordingName = recipe.name;
      addLog('info', 'Scheduler', `Running: "${recipe.name}"`);
      try {
        await playRecording(String(recipe.id));
        addLog('success', 'Scheduler', `"${recipe.name}" completed`);
      } catch (e) {
        addLog('error', 'Scheduler', `"${recipe.name}" failed: ${(e as Error).message}`);
      }
      await sleep(2000);
    }

    lastRunAt = new Date().toISOString();
    addLog('success', 'Scheduler', `All recordings complete`);
  } finally {
    currentRecordingName = null;
    isRunning = false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
