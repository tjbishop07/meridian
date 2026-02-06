import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Upload, FileText, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts';
import type { CSVFormat, ImportPreview, ImportResult } from '../types';

type Step = 'select' | 'preview' | 'complete';

interface LocationState {
  filePath?: string;
  accountId?: number;
  format?: CSVFormat;
}

export default function Import() {
  const { accounts, loadAccounts } = useAccounts();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [step, setStep] = useState<Step>('select');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<number>(0);
  const [detectedFormat, setDetectedFormat] = useState<CSVFormat | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle auto-import from browser mode
  useEffect(() => {
    if (state?.filePath && state?.accountId && state?.format) {
      console.log('[Import] Auto-importing from browser mode:', state);
      setSelectedFile(state.filePath);
      setSelectedAccount(state.accountId);
      setDetectedFormat(state.format);

      // Automatically trigger preview
      const autoPreview = async () => {
        try {
          setIsLoading(true);
          setError(null);

          const previewData = await window.electron.invoke('import:preview', {
            filePath: state.filePath!,
            accountId: state.accountId!,
            format: state.format!,
          });

          setPreview(previewData);
          setStep('preview');
          setIsLoading(false);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to preview import');
          setIsLoading(false);
        }
      };

      autoPreview();
    }
  }, [state]);

  // Step 1: File Selection
  const handleFileSelect = async () => {
    try {
      const filePath = await window.electron.invoke('dialog:open-file', {
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      });

      if (!filePath) return;

      setIsLoading(true);
      setError(null);
      setSelectedFile(filePath);

      // Detect format
      const format = await window.electron.invoke('import:detect-format', filePath);

      if (!format) {
        setError('Could not detect CSV format. Please check the file.');
        setIsLoading(false);
        return;
      }

      setDetectedFormat(format);
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file');
      setIsLoading(false);
    }
  };

  // Step 2: Preview with duplicate detection
  const handlePreview = async () => {
    if (!selectedFile || !detectedFormat || !selectedAccount) {
      setError('Please select a file and account');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const previewData = await window.electron.invoke('import:preview', {
        filePath: selectedFile,
        accountId: selectedAccount,
        format: detectedFormat,
      });

      setPreview(previewData);
      setStep('preview');
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview import');
      setIsLoading(false);
    }
  };

  // Step 3: Execute import
  const handleImport = async (skipDuplicates: boolean) => {
    if (!preview || !selectedFile || !selectedAccount) return;

    try {
      setIsLoading(true);
      setError(null);

      const fileName = selectedFile.split('/').pop() || 'import.csv';

      const importResult = await window.electron.invoke('import:execute', {
        accountId: selectedAccount,
        rows: preview.rows,
        skipDuplicates,
        filename: fileName,
        format: detectedFormat?.name || 'Unknown',
      });

      setResult(importResult);
      setStep('complete');
      setIsLoading(false);

      // Reload accounts to update balances
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import transactions');
      setIsLoading(false);
    }
  };

  const reset = () => {
    setStep('select');
    setSelectedFile(null);
    setSelectedAccount(0);
    setDetectedFormat(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-base-content mb-2">Import Transactions</h1>
      <p className="text-base-content/70 mb-8">
        Import transactions from CSV files exported by your bank
      </p>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800 font-medium">Error</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center gap-4">
          {/* Step 1 */}
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                step === 'select'
                  ? 'bg-primary text-primary-content'
                  : 'bg-green-600 text-white'
              }`}
            >
              {step === 'select' ? '1' : <CheckCircle className="w-5 h-5" />}
            </div>
            <span className="text-sm font-medium text-base-content/80">Select File</span>
          </div>

          <div className="w-12 h-px bg-base-content/30" />

          {/* Step 2 */}
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                step === 'preview'
                  ? 'bg-primary text-primary-content'
                  : step === 'complete'
                  ? 'bg-green-600 text-white'
                  : 'bg-base-content/30 text-base-content/70'
              }`}
            >
              {step === 'complete' ? <CheckCircle className="w-5 h-5" /> : '2'}
            </div>
            <span className="text-sm font-medium text-base-content/80">Preview</span>
          </div>

          <div className="w-12 h-px bg-base-content/30" />

          {/* Step 3 */}
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                step === 'complete'
                  ? 'bg-green-600 text-white'
                  : 'bg-base-content/30 text-base-content/70'
              }`}
            >
              3
            </div>
            <span className="text-sm font-medium text-base-content/80">Complete</span>
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-base-100 rounded-lg shadow-md p-8">
        {/* STEP 1: File Selection */}
        {step === 'select' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-base-content/80 mb-2">
                Select Account *
              </label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(Number(e.target.value))}
                className="w-full px-4 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
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
              <label className="block text-sm font-medium text-base-content/80 mb-2">
                CSV File
              </label>
              <button
                onClick={handleFileSelect}
                disabled={isLoading || !selectedAccount}
                className="w-full px-6 py-12 border-2 border-dashed border-base-300 rounded-lg hover:border-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex flex-col items-center gap-3">
                  {selectedFile ? (
                    <>
                      <FileText className="w-12 h-12 text-green-600" />
                      <div className="text-sm">
                        <p className="font-medium text-base-content">
                          {selectedFile.split('/').pop()}
                        </p>
                        {detectedFormat && (
                          <p className="text-base-content/70">
                            Format: {detectedFormat.name} ({detectedFormat.institution})
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-base-content/50" />
                      <p className="text-base-content/70">
                        {isLoading ? 'Reading file...' : 'Click to select CSV file'}
                      </p>
                    </>
                  )}
                </div>
              </button>
            </div>

            {selectedFile && detectedFormat && (
              <button
                onClick={handlePreview}
                disabled={isLoading}
                className="w-full px-6 py-3 bg-primary text-primary-content rounded-lg hover:bg-primary/80 disabled:opacity-50 font-medium"
              >
                {isLoading ? 'Loading...' : 'Continue to Preview'}
              </button>
            )}
          </div>
        )}

        {/* STEP 2: Preview */}
        {step === 'preview' && preview && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-600 font-medium">Total Rows</p>
                <p className="text-2xl font-bold text-blue-900">{preview.rows.length}</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <p className="text-sm text-yellow-600 font-medium">Duplicates</p>
                <p className="text-2xl font-bold text-yellow-900">{preview.duplicates.length}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium">To Import</p>
                <p className="text-2xl font-bold text-green-900">
                  {preview.rows.length - preview.duplicates.length}
                </p>
              </div>
            </div>

            {preview.duplicates.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 font-medium mb-2">
                  Found {preview.duplicates.length} potential duplicates
                </p>
                <p className="text-yellow-700 text-sm">
                  These transactions appear to already exist in your account. They will be skipped during import.
                </p>
              </div>
            )}

            {preview.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-medium mb-2">
                  {preview.errors.length} rows have errors
                </p>
                <ul className="text-red-700 text-sm space-y-1">
                  {preview.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>
                      Row {err.row}: {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sample Transactions */}
            <div>
              <h3 className="text-sm font-medium text-base-content/80 mb-2">Sample Transactions (first 5)</h3>
              <div className="border border-base-300 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-base-300">
                  <thead className="bg-base-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-base-content/60">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-base-content/60">Description</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-base-content/60">Category</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-base-content/60">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-base-100 divide-y divide-base-300">
                    {preview.rows.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-sm text-base-content">{row.date}</td>
                        <td className="px-4 py-2 text-sm text-base-content">{row.description}</td>
                        <td className="px-4 py-2 text-sm text-base-content/70">{row.category || '-'}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium">
                          ${Math.abs(row.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleImport(true)}
                disabled={isLoading}
                className="flex-1 px-6 py-3 bg-primary text-primary-content rounded-lg hover:bg-primary/80 disabled:opacity-50 font-medium"
              >
                {isLoading ? 'Importing...' : 'Import Transactions'}
              </button>
              <button
                onClick={() => setStep('select')}
                disabled={isLoading}
                className="px-6 py-3 bg-base-200 text-base-content/80 rounded-lg hover:bg-base-300 disabled:opacity-50 font-medium"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Complete */}
        {step === 'complete' && result && (
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-base-content mb-2">Import Complete!</h2>
              <p className="text-base-content/70">
                Your transactions have been successfully imported
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium">Imported</p>
                <p className="text-3xl font-bold text-green-900">{result.imported}</p>
              </div>
              <div className="bg-base-200 rounded-lg p-4">
                <p className="text-sm text-base-content/70 font-medium">Skipped</p>
                <p className="text-3xl font-bold text-base-content">{result.skipped}</p>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => (window.location.hash = '#/transactions')}
                className="px-6 py-3 bg-primary text-primary-content rounded-lg hover:bg-primary/80 font-medium"
              >
                View Transactions
              </button>
              <button
                onClick={reset}
                className="px-6 py-3 bg-base-200 text-base-content/80 rounded-lg hover:bg-base-300 font-medium"
              >
                Import Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
