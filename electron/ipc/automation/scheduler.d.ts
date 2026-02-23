export declare const INTERVAL_TO_CRON: Record<string, string>;
export declare const CRON_TO_INTERVAL: Record<string, string>;
export declare function initScheduler(): void;
export declare function start(cronExpr: string): void;
export declare function stop(): void;
export interface ScheduleStatus {
    isRunning: boolean;
    currentRecordingName: string | null;
    lastRunAt: string | null;
    cronExpr: string | null;
    interval: string | null;
    enabled: boolean;
}
export declare function getStatus(): ScheduleStatus;
export declare function runAllNow(): Promise<void>;
