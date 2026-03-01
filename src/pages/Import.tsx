import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Upload, FileText, CheckCircle, AlertCircle, Check, Plus, X, ArrowRight, RotateCcw, Play, Clock, Loader2, Calendar } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { Automation, type AutomationHandle } from './Automation';
import type { CSVFormat, ImportPreview, ImportResult } from '../types';
import { Button } from '@/components/ui/button';
import { AccentButton } from '@/components/ui/accent-button';
import { SidebarButton } from '@/components/ui/SidebarButton';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PageSidebar } from '@/components/ui/PageSidebar';
import { usePageEntrance } from '../hooks/usePageEntrance';
import { cn } from '@/lib/utils';

interface ScheduleStatus {
  isRunning: boolean;
  currentRecordingName: string | null;
  lastRunAt: string | null;
  cronExpr: string | null;
  interval: string | null;
  enabled: boolean;
}

const INTERVAL_OPTIONS = [
  { value: 'hourly',    label: 'Every hour' },
  { value: 'every_4h',  label: 'Every 4 hours' },
  { value: 'every_6h',  label: 'Every 6 hours' },
  { value: 'every_12h', label: 'Every 12 hours' },
  { value: 'daily',     label: 'Daily at 6 AM' },
  { value: 'weekly',    label: 'Weekly (Mon 6 AM)' },
];

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type Step = 'select' | 'preview' | 'complete';

const STEPS = [
  { key: 'select', label: 'Select File' },
  { key: 'preview', label: 'Preview' },
  { key: 'complete', label: 'Complete' },
] as const;

export default function Import() {
  const { accounts, loadAccounts } = useAccounts();
  const automationRef = useRef<AutomationHandle>(null);
  const location = useLocation();

  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus | null>(null);
  const [scheduleInterval, setScheduleInterval] = useState('daily');
  const [scheduleUpdating, setScheduleUpdating] = useState(false);

  // Load and poll schedule status
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const status = await window.electron.invoke('schedule:get-status') as ScheduleStatus;
        if (!cancelled) {
          setScheduleStatus(status);
          if (status.interval) setScheduleInterval(status.interval);
        }
      } catch { /* ignore */ }
    };
    load();
    const id = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const handleScheduleToggle = async (enabled: boolean) => {
    setScheduleUpdating(true);
    try {
      const status = await window.electron.invoke('schedule:update', { enabled, interval: scheduleInterval }) as ScheduleStatus;
      setScheduleStatus(status);
    } finally {
      setScheduleUpdating(false);
    }
  };

  const handleIntervalChange = async (interval: string) => {
    setScheduleInterval(interval);
    if (scheduleStatus?.enabled) {
      setScheduleUpdating(true);
      try {
        const status = await window.electron.invoke('schedule:update', { enabled: true, interval }) as ScheduleStatus;
        setScheduleStatus(status);
      } finally {
        setScheduleUpdating(false);
      }
    }
  };

  const handleRunNow = async () => {
    await window.electron.invoke('schedule:run-now');
    setTimeout(async () => {
      try {
        const status = await window.electron.invoke('schedule:get-status') as ScheduleStatus;
        setScheduleStatus(status);
      } catch { /* ignore */ }
    }, 500);
  };

  const { sidebarClass, contentClass } = usePageEntrance();
  const [drawerOpen, setDrawerOpen] = useState(
    (location.state as any)?.source === 'automation'
  );
  const [step, setStep] = useState<Step>('select');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [detectedFormat, setDetectedFormat] = useState<CSVFormat | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadAccounts(); }, []);

  const resetForm = () => {
    setStep('select'); setSelectedFile(null); setSelectedAccount('');
    setDetectedFormat(null); setPreview(null); setResult(null); setError(null);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    resetForm();
  };

  const handleFileSelect = async () => {
    try {
      const filePath = await window.electron.invoke('dialog:open-file', {
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      });
      if (!filePath) return;
      setIsLoading(true);
      setError(null);
      setSelectedFile(filePath);
      const format = await window.electron.invoke('import:detect-format', filePath);
      if (!format) { setError('Could not detect CSV format.'); setIsLoading(false); return; }
      setDetectedFormat(format);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file');
      setIsLoading(false);
    }
  };

  const handlePreview = async () => {
    if (!selectedFile || !detectedFormat || !selectedAccount) {
      setError('Please select a file and account');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const previewData = await window.electron.invoke('import:preview', {
        filePath: selectedFile, accountId: Number(selectedAccount), format: detectedFormat,
      });
      setPreview(previewData);
      setStep('preview');
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview import');
      setIsLoading(false);
    }
  };

  const handleImport = async (skipDuplicates: boolean) => {
    if (!preview || !selectedFile || !selectedAccount) return;
    try {
      setIsLoading(true);
      setError(null);
      const fileName = selectedFile.split('/').pop() || 'import.csv';
      const importResult = await window.electron.invoke('import:execute', {
        accountId: Number(selectedAccount), rows: preview.rows, skipDuplicates,
        filename: fileName, format: detectedFormat?.name || 'Unknown',
      });
      setResult(importResult);
      setStep('complete');
      setIsLoading(false);
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import transactions');
      setIsLoading(false);
    }
  };

  const stepIndex = STEPS.findIndex(s => s.key === step);
  const scheduleEnabled = scheduleStatus?.enabled ?? false;
  const scheduleRunning = scheduleStatus?.isRunning ?? false;

  return (
    <div className="flex h-full relative overflow-hidden">

      {/* ── Left control panel ──────────────────────────────── */}
      <PageSidebar title="Import" className={sidebarClass}>

        {/* Primary actions */}
        <div className="px-3 pt-3 pb-3 space-y-1.5">
          <SidebarButton variant="primary" onClick={() => setDrawerOpen(true)}>
            <Upload className="w-3.5 h-3.5 shrink-0" />
            Manual CSV Import
          </SidebarButton>
          <SidebarButton onClick={() => automationRef.current?.openNewRecording()}>
            <Plus className="w-3.5 h-3.5 shrink-0" />
            New Recording
          </SidebarButton>
        </div>

        <div className="mx-3 border-t border-border/40" />

        {/* Schedule */}
        <div className="px-3 pt-4 pb-4 flex-1 flex flex-col gap-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/35 px-0.5">
            Schedule
          </p>

          {/* Enable card */}
          <div className={cn(
            'rounded-xl border px-3 py-2.5 transition-all duration-300',
            scheduleEnabled
              ? 'border-emerald-500/25 bg-emerald-500/[0.06]'
              : 'border-border/50 bg-muted/10'
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-6 h-6 rounded-md flex items-center justify-center transition-colors',
                  scheduleEnabled ? 'bg-emerald-500/15' : 'bg-muted/50'
                )}>
                  <Calendar className={cn(
                    'w-3 h-3 transition-colors',
                    scheduleEnabled ? 'text-emerald-400' : 'text-muted-foreground/50'
                  )} />
                </div>
                <div>
                  <p className={cn(
                    'text-[11px] font-semibold leading-none',
                    scheduleEnabled ? 'text-emerald-400' : 'text-foreground/50'
                  )}>
                    {scheduleUpdating ? 'Updating…' : scheduleEnabled ? 'Active' : 'Disabled'}
                  </p>
                  <p className="text-[9px] text-muted-foreground/40 mt-0.5 leading-none">
                    Auto-run all
                  </p>
                </div>
              </div>
              <Switch
                checked={scheduleEnabled}
                onCheckedChange={handleScheduleToggle}
                disabled={scheduleUpdating}
              />
            </div>
          </div>

          {/* Interval selector */}
          <Select value={scheduleInterval} onValueChange={handleIntervalChange}>
            <SelectTrigger className="h-8 text-xs w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVAL_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Last run */}
          {scheduleStatus?.lastRunAt && (
            <div className="flex items-center gap-1.5 px-0.5">
              <Clock className="w-3 h-3 text-muted-foreground/35 shrink-0" />
              <span className="text-[10px] text-muted-foreground/45">
                Last: {formatRelativeTime(scheduleStatus.lastRunAt)}
              </span>
            </div>
          )}

          {/* Run Now / Running status */}
          <div className="mt-auto">
            {scheduleRunning ? (
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-primary/8 border border-primary/20">
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-primary leading-none mb-0.5">Running</p>
                  {scheduleStatus?.currentRecordingName && (
                    <p className="text-[9px] text-primary/55 leading-none truncate">
                      {scheduleStatus.currentRecordingName}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="w-full justify-start text-xs h-9 gap-2"
                onClick={handleRunNow}
              >
                <Play className="w-3 h-3 shrink-0" />
                Run All Now
              </Button>
            )}
          </div>
        </div>

      </PageSidebar>

      {/* ── Main recordings area ─────────────────────────────── */}
      <div className={cn('flex-1 overflow-hidden', contentClass)}>
        <Automation ref={automationRef} embedded />
      </div>

      {/* Overlay */}
      <div
        className={cn(
          'absolute inset-0 z-40 bg-black/50 transition-opacity duration-300 backdrop-blur-[2px]',
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={closeDrawer}
      />

      {/* ── Manual Import Drawer — slides from the right ─────── */}
      <div
        className={cn(
          'absolute inset-y-0 right-0 z-50 w-[500px] bg-card border-l border-border flex flex-col',
          'transition-transform duration-300 ease-in-out',
          drawerOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-border/50 flex-shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/40 mb-0.5">Import</p>
            <h2 className="text-[17px] font-semibold text-foreground leading-tight">CSV Transactions</h2>
          </div>
          <button
            onClick={closeDrawer}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-5 flex-shrink-0 border-b border-border/40">
          <div className="flex items-center">
            {STEPS.map((s, idx) => {
              const isDone = stepIndex > idx;
              const isActive = stepIndex === idx;
              return (
                <div key={s.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300',
                      isDone
                        ? 'bg-primary text-primary-foreground'
                        : isActive
                        ? 'bg-primary text-primary-foreground ring-[3px] ring-primary/25 ring-offset-1 ring-offset-card'
                        : 'bg-muted text-muted-foreground/50'
                    )}>
                      {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                    </div>
                    <span className={cn(
                      'text-[10px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap transition-colors',
                      isActive ? 'text-foreground' : 'text-muted-foreground/40'
                    )}>
                      {s.label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={cn(
                      'flex-1 h-px mx-4 mb-5 transition-all duration-500',
                      stepIndex > idx ? 'bg-primary/60' : 'bg-border/60'
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/8 px-4 py-3.5 text-sm">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-destructive">{error}</p>
            </div>
          )}

          {/* ── Step: Select ─────────────────────────────── */}
          {step === 'select' && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
                  Account
                </Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger className="w-full h-10">
                    <SelectValue placeholder="Select an account…" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={String(account.id)}>
                        {account.name} — {account.institution}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
                  CSV File
                </Label>
                <button
                  onClick={handleFileSelect}
                  disabled={isLoading || !selectedAccount}
                  className={cn(
                    'group w-full rounded-xl border-2 border-dashed px-6 py-12 text-center transition-all duration-200',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                    selectedFile
                      ? 'border-primary/50 bg-primary/5 hover:bg-primary/8'
                      : 'border-border/50 hover:border-primary/40 hover:bg-muted/25'
                  )}
                >
                  {selectedFile ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/12 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground leading-snug">
                          {selectedFile.split('/').pop()}
                        </p>
                        {detectedFormat && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {detectedFormat.name} · {detectedFormat.institution}
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground/50">Click to change file</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center group-hover:bg-muted transition-colors">
                        <Upload className="w-6 h-6 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {isLoading ? 'Reading file…' : 'Click to select a CSV file'}
                        </p>
                        <p className="text-xs text-muted-foreground/50 mt-0.5">USAA, Chase, and more</p>
                      </div>
                    </div>
                  )}
                </button>
              </div>

              {selectedFile && detectedFormat && (
                <Button onClick={handlePreview} disabled={isLoading} className="w-full h-10 gap-2">
                  {isLoading ? 'Loading…' : (
                    <>Preview Transactions <ArrowRight className="w-3.5 h-3.5" /></>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* ── Step: Preview ────────────────────────────── */}
          {step === 'preview' && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Rows', value: preview.rows.length, className: 'border-border/60' },
                  { label: 'Duplicates', value: preview.duplicates.length, className: 'border-amber-500/20 bg-amber-500/5', valueClass: 'text-amber-400' },
                  { label: 'To Import', value: preview.rows.length - preview.duplicates.length, className: 'border-emerald-500/20 bg-emerald-500/5', valueClass: 'text-emerald-400' },
                ].map(({ label, value, className, valueClass }) => (
                  <div key={label} className={cn('rounded-xl border px-4 py-3.5', className)}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1.5">{label}</p>
                    <p className={cn('text-2xl font-bold tabular-nums', valueClass ?? 'text-foreground')}>{value}</p>
                  </div>
                ))}
              </div>

              {preview.duplicates.length > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-amber-300/90">
                    {preview.duplicates.length} duplicate{preview.duplicates.length !== 1 ? 's' : ''} detected — will be skipped automatically.
                  </p>
                </div>
              )}

              {preview.errors.length > 0 && (
                <div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <div className="text-destructive space-y-0.5">
                    <p className="font-semibold">{preview.errors.length} rows have errors</p>
                    {preview.errors.slice(0, 3).map((err, i) => (
                      <p key={i} className="text-xs opacity-80">Row {err.row}: {err.error}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border/50 overflow-hidden">
                <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between bg-muted/20">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">Transactions</p>
                  <span className="text-xs text-muted-foreground/60">{preview.rows.length} rows</span>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-card/90 backdrop-blur-sm border-b border-border/40">
                      <tr>
                        <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground/40">Date</th>
                        <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground/40">Description</th>
                        <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-wide text-muted-foreground/40">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {preview.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-muted/25 transition-colors">
                          <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap font-mono">{row.date}</td>
                          <td className="px-4 py-2.5 text-xs text-foreground truncate max-w-[150px]">{row.description}</td>
                          <td className={cn(
                            'px-4 py-2.5 text-xs text-right font-bold whitespace-nowrap tabular-nums font-mono',
                            row.amount < 0 ? 'text-destructive/80' : 'text-emerald-400'
                          )}>
                            {row.amount < 0 ? '−' : '+'}${Math.abs(row.amount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="outline" onClick={() => setStep('select')} disabled={isLoading} className="gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Back
                </Button>
                <Button onClick={() => handleImport(true)} disabled={isLoading} className="flex-1 gap-2">
                  {isLoading ? 'Importing…' : (
                    <>Import {preview.rows.length - preview.duplicates.length} Transactions <ArrowRight className="w-3.5 h-3.5" /></>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ── Step: Complete ───────────────────────────── */}
          {step === 'complete' && result && (
            <div className="flex flex-col items-center text-center py-10 space-y-8">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-24 h-24 rounded-full bg-emerald-500/8 animate-ping" style={{ animationDuration: '2.5s' }} />
                <div className="absolute w-20 h-20 rounded-full bg-emerald-500/10" />
                <div className="relative w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
              </div>

              <div>
                <h2 className="text-xl font-bold text-foreground">Import complete</h2>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  Your transactions have been added to the database.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full max-w-[260px]">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1.5">Imported</p>
                  <p className="text-3xl font-bold tabular-nums text-emerald-400">{result.imported}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 mb-1.5">Skipped</p>
                  <p className="text-3xl font-bold tabular-nums text-foreground">{result.skipped}</p>
                </div>
              </div>

              <div className="flex gap-3 w-full">
                <Button variant="outline" onClick={resetForm} className="flex-1">Import Another</Button>
                <Button
                  onClick={() => { closeDrawer(); window.location.hash = '#/transactions'; }}
                  className="flex-1"
                >
                  View Transactions
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}
