import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import { Automation } from './Automation';
import PageHeader from '../components/layout/PageHeader';
import type { CSVFormat, ImportPreview, ImportResult } from '../types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Step = 'select' | 'preview' | 'complete';
type ImportTab = 'automated' | 'manual';

interface LocationState {
  filePath?: string;
  accountId?: number;
  format?: CSVFormat;
  source?: string;
}

export default function Import() {
  const { accounts, loadAccounts } = useAccounts();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const [importTab, setImportTab] = useState<ImportTab>(
    state?.source === 'automation' ? 'manual' : 'automated'
  );
  const [step, setStep] = useState<Step>('select');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<number>(0);
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
        filePath: selectedFile, accountId: selectedAccount, format: detectedFormat,
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
        accountId: selectedAccount, rows: preview.rows, skipDuplicates,
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
    setStep('select'); setSelectedFile(null); setSelectedAccount(0);
    setDetectedFormat(null); setPreview(null); setResult(null); setError(null);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Import" subtitle="Automate or manually import your transactions">
        <div className="flex gap-6 -mb-4">
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

      {importTab === 'automated' && (
        <div className="flex-1 overflow-hidden">
          <Automation embedded />
        </div>
      )}

      {importTab === 'manual' && (
        <div className="flex-1 overflow-y-auto px-4 pb-4 max-w-4xl mx-auto w-full pt-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-destructive font-medium">Error</p>
                <p className="text-destructive/80 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Step Indicator */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center gap-4">
              {[
                { label: 'Select File', key: 'select' },
                { label: 'Preview', key: 'preview' },
                { label: 'Complete', key: 'complete' },
              ].map((s, idx) => {
                const stepIndex = ['select', 'preview', 'complete'].indexOf(step);
                const isDone = stepIndex > idx;
                const isActive = stepIndex === idx;
                return (
                  <div key={s.key} className="flex items-center gap-2">
                    {idx > 0 && <div className="w-12 h-px bg-border" />}
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm',
                        isDone ? 'bg-success text-success-foreground' :
                        isActive ? 'bg-primary text-primary-foreground' :
                        'bg-muted text-muted-foreground'
                      )}
                    >
                      {isDone ? <CheckCircle className="w-5 h-5" /> : idx + 1}
                    </div>
                    <span className="text-sm font-medium text-foreground/80">{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step Content */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-8">
            {step === 'select' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-2">Select Account *</label>
                  <select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-ring"
                  >
                    <option value={0}>Choose an account...</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} - {account.institution}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-2">CSV File</label>
                  <button
                    onClick={handleFileSelect}
                    disabled={isLoading || !selectedAccount}
                    className="w-full px-6 py-12 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex flex-col items-center gap-3">
                      {selectedFile ? (
                        <>
                          <FileText className="w-12 h-12 text-success" />
                          <div className="text-sm">
                            <p className="font-medium text-foreground">{selectedFile.split('/').pop()}</p>
                            {detectedFormat && (
                              <p className="text-muted-foreground">Format: {detectedFormat.name} ({detectedFormat.institution})</p>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <Upload className="w-12 h-12 text-muted-foreground" />
                          <p className="text-muted-foreground">
                            {isLoading ? 'Reading file...' : 'Click to select CSV file'}
                          </p>
                        </>
                      )}
                    </div>
                  </button>
                </div>

                {selectedFile && detectedFormat && (
                  <Button onClick={handlePreview} disabled={isLoading} className="w-full">
                    {isLoading ? 'Loading...' : 'Continue to Preview'}
                  </Button>
                )}
              </div>
            )}

            {step === 'preview' && preview && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-primary/10 rounded-lg p-4">
                    <p className="text-sm text-primary font-medium">Total Rows</p>
                    <p className="text-2xl font-bold text-foreground">{preview.rows.length}</p>
                  </div>
                  <div className="bg-warning/10 rounded-lg p-4">
                    <p className="text-sm text-warning font-medium">Duplicates</p>
                    <p className="text-2xl font-bold text-foreground">{preview.duplicates.length}</p>
                  </div>
                  <div className="bg-success/10 rounded-lg p-4">
                    <p className="text-sm text-success font-medium">To Import</p>
                    <p className="text-2xl font-bold text-foreground">{preview.rows.length - preview.duplicates.length}</p>
                  </div>
                </div>

                {preview.duplicates.length > 0 && (
                  <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
                    <p className="text-warning-foreground font-medium mb-1">Found {preview.duplicates.length} potential duplicates</p>
                    <p className="text-warning-foreground/70 text-sm">These transactions appear to already exist and will be skipped.</p>
                  </div>
                )}

                {preview.errors.length > 0 && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                    <p className="text-destructive font-medium mb-2">{preview.errors.length} rows have errors</p>
                    <ul className="text-destructive/80 text-sm space-y-1">
                      {preview.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>Row {err.row}: {err.error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium text-foreground/80 mb-2">
                    Transactions to Import ({preview.rows.length} total)
                  </h3>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="max-h-96 overflow-y-auto">
                      <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Date</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Description</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Category</th>
                            <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="bg-card divide-y divide-border">
                          {preview.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-muted/50">
                              <td className="px-4 py-2 text-sm text-muted-foreground">{i + 1}</td>
                              <td className="px-4 py-2 text-sm text-foreground whitespace-nowrap">{row.date}</td>
                              <td className="px-4 py-2 text-sm text-foreground">{row.description}</td>
                              <td className="px-4 py-2 text-sm text-muted-foreground">{row.category || '-'}</td>
                              <td className="px-4 py-2 text-sm text-right font-medium whitespace-nowrap">
                                <span className={row.amount < 0 ? 'text-destructive' : 'text-success'}>
                                  {row.amount < 0 ? '-' : '+'}${Math.abs(row.amount).toFixed(2)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={() => handleImport(true)} disabled={isLoading} className="flex-1">
                    {isLoading ? 'Importing...' : 'Import Transactions'}
                  </Button>
                  <Button variant="outline" onClick={() => setStep('select')} disabled={isLoading}>
                    Back
                  </Button>
                </div>
              </div>
            )}

            {step === 'complete' && result && (
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-success/10 rounded-full">
                  <CheckCircle className="w-10 h-10 text-success" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">Import Complete!</h2>
                  <p className="text-muted-foreground">Your transactions have been successfully imported</p>
                </div>
                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                  <div className="bg-success/10 rounded-lg p-4">
                    <p className="text-sm text-success font-medium">Imported</p>
                    <p className="text-3xl font-bold text-foreground">{result.imported}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-4">
                    <p className="text-sm text-muted-foreground font-medium">Skipped</p>
                    <p className="text-3xl font-bold text-foreground">{result.skipped}</p>
                  </div>
                </div>
                <div className="flex gap-3 justify-center">
                  <Button onClick={() => (window.location.hash = '#/transactions')}>
                    View Transactions
                  </Button>
                  <Button variant="outline" onClick={reset}>
                    Import Another File
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
