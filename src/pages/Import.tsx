import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Upload, FileText, CheckCircle, AlertCircle, Check, Plus } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { Automation, type AutomationHandle } from './Automation';
import { useAutomationSettings } from '../hooks/useAutomationSettings';
import PageHeader from '../components/layout/PageHeader';
import type { CSVFormat, ImportPreview, ImportResult } from '../types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type Step = 'select' | 'preview' | 'complete';
type ImportTab = 'automated' | 'manual';

interface LocationState {
  filePath?: string;
  accountId?: number;
  format?: CSVFormat;
  source?: string;
}

const STEPS = [
  { key: 'select', label: 'Select File' },
  { key: 'preview', label: 'Preview' },
  { key: 'complete', label: 'Complete' },
] as const;

export default function Import() {
  const { accounts, loadAccounts } = useAccounts();
  const { settings: automationSettings, updateSettings: updateAutomationSettings } = useAutomationSettings();
  const automationRef = useRef<AutomationHandle>(null);
  const location = useLocation();
  const state = location.state as LocationState | null;
  const [importTab, setImportTab] = useState<ImportTab>(
    state?.source === 'automation' ? 'manual' : 'automated'
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

  const reset = () => {
    setStep('select'); setSelectedFile(null); setSelectedAccount('');
    setDetectedFormat(null); setPreview(null); setResult(null); setError(null);
  };

  const stepIndex = STEPS.findIndex(s => s.key === step);

  return (
    <div className="flex flex-col h-full">
      <PageHeader>
        <div className="flex gap-6">
          {(['automated', 'manual'] as ImportTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setImportTab(tab)}
              className={cn(
                'py-3 px-1 border-b-2 font-medium text-sm transition-colors capitalize',
                importTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground/80'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </PageHeader>

      {/* Toolbar — shown for automated tab */}
      {importTab === 'automated' && (
        <div className="flex items-center gap-3 px-6 h-11 border-b border-border flex-shrink-0">
          <span className="text-xs text-muted-foreground font-medium">AI Model</span>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            {([
              { value: 'claude', label: 'Claude Vision' },
              { value: 'ollama', label: 'Local Ollama' },
            ] as const).map((opt, idx) => (
              <Button
                key={opt.value}
                variant="ghost"
                size="sm"
                onClick={() => updateAutomationSettings({ vision_provider: opt.value })}
                className={cn(
                  'h-7 px-3 text-xs rounded-none',
                  idx > 0 && 'border-l border-border',
                  automationSettings.vision_provider === opt.value
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="flex-1" />
          <Button size="sm" onClick={() => automationRef.current?.openNewRecording()}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Recording
          </Button>
        </div>
      )}

      {importTab === 'automated' && (
        <div className="flex-1 overflow-hidden">
          <Automation ref={automationRef} embedded />
        </div>
      )}

      {importTab === 'manual' && (
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-2xl mx-auto space-y-6">

            {/* Step indicator */}
            <div className="flex items-center gap-2">
              {STEPS.map((s, idx) => {
                const isDone = stepIndex > idx;
                const isActive = stepIndex === idx;
                return (
                  <div key={s.key} className="flex items-center gap-2">
                    {idx > 0 && <div className="w-8 h-px bg-border" />}
                    <div className="flex items-center gap-1.5">
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                        isDone ? 'bg-primary text-primary-foreground' :
                        isActive ? 'bg-primary text-primary-foreground' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                      </div>
                      <span className={cn(
                        'text-sm',
                        isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                      )}>{s.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-destructive">{error}</p>
              </div>
            )}

            {/* Step: Select */}
            {step === 'select' && (
              <Card>
                <CardContent className="pt-6 space-y-5">
                  <div className="space-y-2">
                    <Label>Account</Label>
                    <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                      <SelectTrigger className="w-full">
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

                  <Separator />

                  <div className="space-y-2">
                    <Label>CSV File</Label>
                    <button
                      onClick={handleFileSelect}
                      disabled={isLoading || !selectedAccount}
                      className={cn(
                        'w-full rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        selectedFile
                          ? 'border-primary/40 bg-primary/5 hover:bg-primary/8'
                          : 'border-border hover:border-primary/40 hover:bg-muted/40'
                      )}
                    >
                      {selectedFile ? (
                        <div className="flex flex-col items-center gap-2">
                          <FileText className="w-8 h-8 text-primary" />
                          <p className="font-medium text-sm text-foreground">
                            {selectedFile.split('/').pop()}
                          </p>
                          {detectedFormat && (
                            <Badge variant="secondary" className="text-xs">
                              {detectedFormat.name} · {detectedFormat.institution}
                            </Badge>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">Click to change file</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="w-8 h-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            {isLoading ? 'Reading file…' : 'Click to select a CSV file'}
                          </p>
                        </div>
                      )}
                    </button>
                  </div>

                  {selectedFile && detectedFormat && (
                    <Button onClick={handlePreview} disabled={isLoading} className="w-full">
                      {isLoading ? 'Loading…' : 'Continue to Preview'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step: Preview */}
            {step === 'preview' && preview && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Total Rows', value: preview.rows.length, color: 'text-foreground' },
                    { label: 'Duplicates', value: preview.duplicates.length, color: 'text-amber-500' },
                    { label: 'To Import', value: preview.rows.length - preview.duplicates.length, color: 'text-emerald-500' },
                  ].map(({ label, value, color }) => (
                    <Card key={label}>
                      <CardContent className="pt-4 pb-4">
                        <p className="text-xs text-muted-foreground mb-1">{label}</p>
                        <p className={cn('text-2xl font-bold', color)}>{value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {preview.duplicates.length > 0 && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-amber-600 dark:text-amber-400">
                      {preview.duplicates.length} duplicate{preview.duplicates.length !== 1 ? 's' : ''} found — these will be skipped.
                    </p>
                  </div>
                )}

                {preview.errors.length > 0 && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <div className="text-destructive space-y-0.5">
                      <p className="font-medium">{preview.errors.length} rows have errors</p>
                      {preview.errors.slice(0, 3).map((err, i) => (
                        <p key={i} className="text-xs opacity-80">Row {err.row}: {err.error}</p>
                      ))}
                    </div>
                  </div>
                )}

                <Card>
                  <CardContent className="p-0">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-medium">
                        Transactions <span className="text-muted-foreground font-normal">({preview.rows.length})</span>
                      </p>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Date</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Category</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {preview.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-muted/40 transition-colors">
                              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{row.date}</td>
                              <td className="px-4 py-3 text-foreground max-w-[180px] truncate">{row.description}</td>
                              <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{row.category || '—'}</td>
                              <td className={cn(
                                'px-4 py-3 text-right font-medium whitespace-nowrap tabular-nums',
                                row.amount < 0 ? 'text-destructive' : 'text-emerald-500'
                              )}>
                                {row.amount < 0 ? '-' : '+'}${Math.abs(row.amount).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('select')} disabled={isLoading}>
                    Back
                  </Button>
                  <Button onClick={() => handleImport(true)} disabled={isLoading} className="flex-1">
                    {isLoading ? 'Importing…' : 'Import Transactions'}
                  </Button>
                </div>
              </div>
            )}

            {/* Step: Complete */}
            {step === 'complete' && result && (
              <Card>
                <CardContent className="pt-8 pb-8 text-center space-y-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10">
                    <CheckCircle className="w-7 h-7 text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Import complete</h2>
                    <p className="text-sm text-muted-foreground mt-1">Your transactions have been added.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                    <div className="rounded-lg bg-muted px-4 py-3">
                      <p className="text-xs text-muted-foreground mb-1">Imported</p>
                      <p className="text-2xl font-bold text-emerald-500">{result.imported}</p>
                    </div>
                    <div className="rounded-lg bg-muted px-4 py-3">
                      <p className="text-xs text-muted-foreground mb-1">Skipped</p>
                      <p className="text-2xl font-bold text-foreground">{result.skipped}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button variant="outline" onClick={reset}>Import Another</Button>
                    <Button onClick={() => (window.location.hash = '#/transactions')}>
                      View Transactions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
