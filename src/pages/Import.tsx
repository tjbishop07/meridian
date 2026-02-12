import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Upload, FileText, CheckCircle, AlertCircle, Download, Globe, Sparkles, Zap, Play, StopCircle, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAccounts } from '../hooks/useAccounts';
import { useOllama } from '../hooks/useOllama';
import { usePuppeteerScraper } from '../hooks/usePuppeteerScraper';
import OllamaSetup from '../components/OllamaSetup';
import type { CSVFormat, ImportPreview, ImportResult } from '../types';

type Step = 'select' | 'preview' | 'complete';
type ImportMethod = 'csv' | 'browser' | 'ai-scrape' | 'puppeteer';

interface LocationState {
  filePath?: string;
  accountId?: number;
  format?: CSVFormat;
  scrapedTransactions?: any[];
  source?: string;
}

export default function Import() {
  const { accounts, loadAccounts } = useAccounts();
  const { status: ollamaStatus } = useOllama();
  const puppeteer = usePuppeteerScraper();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [importMethod, setImportMethod] = useState<ImportMethod>('csv');
  const [step, setStep] = useState<Step>('select');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<number>(0);
  const [detectedFormat, setDetectedFormat] = useState<CSVFormat | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingScrape, setIsProcessingScrape] = useState(false);
  const [puppeteerUrl, setPuppeteerUrl] = useState('https://www.usaa.com');
  const [useUserProfile, setUseUserProfile] = useState(true); // Default to true to bypass detection
  const [showSaveRecipeModal, setShowSaveRecipeModal] = useState(false);
  const [recipeName, setRecipeName] = useState('');
  const [recipeInstitution, setRecipeInstitution] = useState('');

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

  // Handle scraped transactions from automation
  useEffect(() => {
    if (state?.scrapedTransactions && state?.source === 'automation') {
      console.log('[Import] Received scraped transactions from automation:', state.scrapedTransactions.length);

      // Convert scraped transactions to preview format
      const previewData: ImportPreview = {
        format: 'usaa' as CSVFormat, // Default format
        rows: state.scrapedTransactions.map((txn: any) => ({
          date: txn.date,
          description: txn.description,
          original_description: txn.description,
          category: txn.category || '',
          amount: parseFloat(txn.amount) || 0,
          status: 'Posted',
        })),
        duplicates: [], // No duplicates for now
        errors: [], // No errors for AI-scraped data
      };

      setPreview(previewData);
      setStep('preview');
      setImportMethod('ai-scrape');
      toast.success(`Loaded ${state.scrapedTransactions.length} scraped transactions!`);
    }
  }, [state?.scrapedTransactions]);

  // Listen for scraped transactions
  useEffect(() => {
    const handleScrapedTransactions = async (data: { accountId: number; transactions: any[] }) => {
      // Prevent processing multiple times
      if (isProcessingScrape) {
        console.log('[Import] Already processing scrape, ignoring duplicate event');
        return;
      }

      console.log('[Import] Received scraped transactions:', data);
      setIsProcessingScrape(true);

      try {
        setIsLoading(true);
        setError(null);
        setSelectedAccount(data.accountId);
        setDetectedFormat({ name: 'Web Scrape', institution: 'USAA', columns: [] });

        // Convert scraped data to preview format
        const convertedRows = data.transactions.map((txn: any) => {
          // Parse date to YYYY-MM-DD format
          let parsedDate = txn.date;
          try {
            const date = new Date(txn.date);
            if (!isNaN(date.getTime())) {
              parsedDate = date.toISOString().split('T')[0];
            }
          } catch (e) {
            console.warn('Failed to parse date:', txn.date);
          }

          // Parse amount
          let amount = 0;
          if (txn.amount) {
            const cleanAmount = txn.amount.toString().replace(/[$,\s]/g, '');
            amount = parseFloat(cleanAmount);
            if (isNaN(amount)) amount = 0;
          }

          return {
            date: parsedDate,
            description: txn.description || 'Unknown',
            original_description: txn.description || 'Unknown',
            amount: amount,
            category: txn.category || '',
            status: 'Posted'
          };
        }).filter((txn: any) => txn.date && txn.amount !== 0);

        // Create preview data (simplified - no duplicate detection for now)
        const previewData: ImportPreview = {
          format: { name: 'Web Scrape', institution: 'USAA', columns: { date: '', description: '', amount: '' }, dateFormat: '', amountMultiplier: 1 },
          rows: convertedRows,
          duplicates: [],
          errors: []
        };

        setPreview(previewData);
        setStep('preview');
        setIsLoading(false);

        // Reset processing flag after a delay
        setTimeout(() => setIsProcessingScrape(false), 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process scraped transactions');
        setIsLoading(false);
        setIsProcessingScrape(false);
      }
    };

    window.electron.on('scraper:transactions-found', handleScrapedTransactions);

    return () => {
      window.electron.removeListener('scraper:transactions-found', handleScrapedTransactions);
    };
  }, []);

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

  // Manual browser scrape
  const handleOpenBrowserScrape = async () => {
    if (!selectedAccount) {
      setError('Please select an account first');
      return;
    }

    try {
      setError(null);
      await window.electron.invoke('scraper:open-browser', {
        accountId: selectedAccount,
        startUrl: 'https://www.usaa.com', // Or let user enter URL
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open browser');
    }
  };

  // AI browser scrape
  const handleOpenAIScrape = async () => {
    if (!selectedAccount) {
      setError('Please select an account first');
      return;
    }

    const isOllamaReady = ollamaStatus.installed && ollamaStatus.running && ollamaStatus.hasVisionModel;
    if (!isOllamaReady) {
      setError('Please complete Ollama setup first');
      return;
    }

    try {
      setError(null);

      // Check if the correct model is installed
      const modelCheck = await window.electron.invoke('ai-scraper:check-model');

      if (!modelCheck.installed) {
        setError('Model "llama3.2" not found. Please download it in the Ollama Setup section below (click "Download AI Model").');
        return;
      }

      await window.electron.invoke('ai-scraper:open-browser', {
        accountId: selectedAccount,
        startUrl: 'https://www.usaa.com',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open browser');
    }
  };

  // Puppeteer scraper handlers
  const handleStartPuppeteer = async () => {
    if (!selectedAccount) {
      setError('Please select an account first');
      return;
    }

    if (!puppeteer.status.chromeFound) {
      setError('Chrome not found. Please install Google Chrome, Chromium, or Brave browser.');
      return;
    }

    try {
      setError(null);
      const result = await puppeteer.startBrowser(puppeteerUrl, undefined, useUserProfile);

      if (!result.success) {
        setError(result.error || 'Failed to start browser');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Puppeteer browser');
    }
  };

  const handleStartPuppeteerRecording = async () => {
    try {
      setError(null);
      const result = await puppeteer.startRecording();

      if (!result.success) {
        setError(result.error || 'Failed to start recording');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
    }
  };

  const handleStopPuppeteerRecording = async () => {
    try {
      setError(null);
      const result = await puppeteer.stopRecording();

      if (result.success) {
        console.log('[Puppeteer] Recording stopped with', result.steps?.length || 0, 'steps');

        // Show save dialog if we have steps
        if (result.steps && result.steps.length > 0) {
          setShowSaveRecipeModal(true);
        } else {
          setError('No steps recorded. Try interacting with the page before stopping.');
        }
      } else {
        setError(result.error || 'Failed to stop recording');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop recording');
    }
  };

  const handleSaveRecipe = async () => {
    if (!recipeName.trim()) {
      setError('Please enter a recipe name');
      return;
    }

    try {
      setError(null);

      // Save recipe to database with the URL where recording started
      await window.electron.invoke('export-recipes:create', {
        name: recipeName.trim(),
        institution: recipeInstitution.trim() || null,
        url: puppeteer.recordingUrl || puppeteerUrl, // Use recording URL, fallback to initial URL
        steps: JSON.stringify(puppeteer.recordedSteps),
      });

      // Close modal and reset
      setShowSaveRecipeModal(false);
      setRecipeName('');
      setRecipeInstitution('');

      // Show success notification
      toast.success(`Recipe "${recipeName.trim()}" saved successfully!`);
      console.log('[Puppeteer] Recipe saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recipe');
    }
  };

  const handleCancelSaveRecipe = () => {
    setShowSaveRecipeModal(false);
    setRecipeName('');
    setRecipeInstitution('');
  };

  const handleExtractPuppeteer = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await puppeteer.extractTransactions();

      if (result.success && result.transactions) {
        // Convert to preview format
        const convertedRows = result.transactions.map((txn: any) => {
          let parsedDate = txn.date;
          try {
            const date = new Date(txn.date);
            if (!isNaN(date.getTime())) {
              parsedDate = date.toISOString().split('T')[0];
            }
          } catch (e) {
            console.warn('Failed to parse date:', txn.date);
          }

          let amount = 0;
          if (txn.amount) {
            const cleanAmount = txn.amount.toString().replace(/[$,\s]/g, '');
            amount = parseFloat(cleanAmount);
            if (isNaN(amount)) amount = 0;
          }

          return {
            date: parsedDate,
            description: txn.description || 'Unknown',
            original_description: txn.description || 'Unknown',
            amount: amount,
            category: '',
            status: 'Posted'
          };
        }).filter((txn: any) => txn.date && txn.amount !== 0);

        const format: CSVFormat = {
          name: 'Puppeteer Scrape',
          institution: 'Auto',
          columns: { date: '', description: '', amount: '' },
          dateFormat: '',
          amountMultiplier: 1
        };

        setSelectedAccount(selectedAccount);
        setDetectedFormat(format);
        setPreview({
          format,
          rows: convertedRows,
          duplicates: [],
          errors: []
        });
        setStep('preview');
      } else {
        setError(result.error || 'Failed to extract transactions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract transactions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClosePuppeteer = async () => {
    try {
      await puppeteer.closeBrowser();
    } catch (err) {
      console.error('Failed to close Puppeteer browser:', err);
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
    setImportMethod('csv');
    setIsProcessingScrape(false);

    // Close Puppeteer browser if open
    if (puppeteer.status.browserOpen) {
      handleClosePuppeteer();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="p-4 flex-shrink-0">
        <h1 className="text-3xl font-bold text-base-content mb-2">Import Transactions</h1>
        <p className="text-base-content/70 mb-4">
          Import transactions from CSV files or scrape directly from your bank's website
        </p>

        {/* Import Method Tabs */}
        <div className="flex gap-2 border-b border-base-300">
          <button
            onClick={() => setImportMethod('csv')}
            className={`px-4 py-2 font-medium transition-colors ${
              importMethod === 'csv'
                ? 'border-b-2 border-primary text-primary'
                : 'text-base-content/60 hover:text-base-content'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              CSV File
            </div>
          </button>
          <button
            onClick={() => setImportMethod('browser')}
            className={`px-4 py-2 font-medium transition-colors ${
              importMethod === 'browser'
                ? 'border-b-2 border-primary text-primary'
                : 'text-base-content/60 hover:text-base-content'
            }`}
          >
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Manual Scrape
            </div>
          </button>
          <button
            onClick={() => setImportMethod('puppeteer')}
            className={`px-4 py-2 font-medium transition-colors ${
              importMethod === 'puppeteer'
                ? 'border-b-2 border-primary text-primary'
                : 'text-base-content/60 hover:text-base-content'
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Auto Scrape
            </div>
          </button>
          <button
            onClick={() => setImportMethod('ai-scrape')}
            className={`px-4 py-2 font-medium transition-colors ${
              importMethod === 'ai-scrape'
                ? 'border-b-2 border-primary text-primary'
                : 'text-base-content/60 hover:text-base-content'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              AI Scrape
            </div>
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
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
        {/* STEP 1: Selection */}
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

            {/* CSV Import */}
            {importMethod === 'csv' && (
              <>

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
              </>
            )}

            {/* Browser Scrape */}
            {importMethod === 'browser' && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 font-medium mb-2">How it works:</p>
                  <ol className="text-blue-700 text-sm space-y-1 list-decimal list-inside">
                    <li>Click "Open Browser" below</li>
                    <li>Manually log in to your bank and navigate to transactions</li>
                    <li>Click the "Scrape This Page" button in the browser</li>
                    <li>Review and import the extracted transactions</li>
                  </ol>
                </div>

                <button
                  onClick={handleOpenBrowserScrape}
                  disabled={isLoading || !selectedAccount}
                  className="w-full px-6 py-12 border-2 border-dashed border-base-300 rounded-lg hover:border-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex flex-col items-center gap-3">
                    <Globe className="w-12 h-12 text-primary" />
                    <p className="text-base-content font-medium">Open Browser</p>
                    <p className="text-base-content/60 text-sm">
                      Navigate to your bank's transaction page
                    </p>
                  </div>
                </button>
              </div>
            )}

            {/* Puppeteer Auto Scrape */}
            {importMethod === 'puppeteer' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <Zap className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <p className="text-green-800 font-medium">Automated Browser Scraping with Puppeteer</p>
                  </div>
                  <ol className="text-green-700 text-sm space-y-1 list-decimal list-inside">
                    <li>Enter your bank's URL and click "Start Browser"</li>
                    <li>Log in to your bank and navigate to transactions</li>
                    <li>Click "Extract Transactions" to automatically scrape the page</li>
                    <li>Review and import - up to 95-99% accuracy!</li>
                  </ol>
                  <p className="text-green-600 text-xs mt-2">
                    💡 Uses Chrome/Chromium with direct DOM extraction - much more accurate than AI parsing!
                  </p>
                </div>

                {/* Chrome Status */}
                {!puppeteer.status.chromeFound && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-yellow-800 font-medium mb-1">Chrome Not Found</p>
                    <p className="text-yellow-700 text-sm mb-2">
                      Please install Google Chrome, Chromium, or Brave browser to use Puppeteer.
                    </p>
                    <button
                      onClick={puppeteer.checkChrome}
                      className="text-yellow-700 underline text-sm hover:text-yellow-800"
                    >
                      Recheck for Chrome
                    </button>
                  </div>
                )}

                {/* Browser URL Input */}
                <div>
                  <label className="block text-sm font-medium text-base-content/80 mb-2">
                    Bank Website URL
                  </label>
                  <input
                    type="url"
                    value={puppeteerUrl}
                    onChange={(e) => setPuppeteerUrl(e.target.value)}
                    placeholder="https://www.usaa.com"
                    disabled={puppeteer.status.browserOpen}
                    className="w-full px-4 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-50"
                  />
                </div>

                {/* Use Chrome Profile Option */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useUserProfile}
                      onChange={(e) => setUseUserProfile(e.target.checked)}
                      disabled={puppeteer.status.browserOpen}
                      className="mt-1 w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary disabled:opacity-50"
                    />
                    <div className="flex-1">
                      <p className="text-amber-900 font-medium text-sm">
                        Use My Chrome Profile (Recommended)
                      </p>
                      <p className="text-amber-700 text-xs mt-1">
                        Uses your real Chrome profile with existing cookies and login sessions.
                        <strong className="block mt-1">⚠️ Important:</strong> Close all Chrome windows before starting,
                        or you may see "Chrome is already running" errors.
                      </p>
                      <p className="text-amber-600 text-xs mt-1">
                        ✅ Bypasses bank detection • ✅ Keeps you logged in • ✅ Uses saved passwords
                      </p>
                    </div>
                  </label>
                </div>

                {/* Browser Controls */}
                {!puppeteer.status.browserOpen ? (
                  <button
                    onClick={handleStartPuppeteer}
                    disabled={puppeteer.isStarting || !selectedAccount || !puppeteer.status.chromeFound}
                    className="w-full px-6 py-12 border-2 border-dashed border-base-300 rounded-lg hover:border-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <Zap className="w-12 h-12 text-primary" />
                      <p className="text-base-content font-medium">
                        {puppeteer.isStarting ? 'Starting Browser...' : 'Start Browser'}
                      </p>
                      <p className="text-base-content/60 text-sm">
                        Opens Chrome with automation enabled
                      </p>
                    </div>
                  </button>
                ) : (
                  <div className="space-y-3">
                    {/* Status */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <p className="text-green-800 font-medium">Browser Active</p>
                        </div>
                        {puppeteer.status.recording && (
                          <div className="flex items-center gap-2">
                            <StopCircle className="w-4 h-4 text-red-500 animate-pulse" />
                            <p className="text-red-700 text-sm font-medium">Recording...</p>
                          </div>
                        )}
                      </div>
                      {puppeteer.recordedSteps.length > 0 && (
                        <p className="text-green-700 text-sm mt-2">
                          Recorded {puppeteer.recordedSteps.length} step{puppeteer.recordedSteps.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>

                    {/* Recording Controls */}
                    <div className="grid grid-cols-2 gap-3">
                      {!puppeteer.status.recording ? (
                        <button
                          onClick={handleStartPuppeteerRecording}
                          className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2"
                        >
                          <StopCircle className="w-4 h-4" />
                          Start Recording
                        </button>
                      ) : (
                        <button
                          onClick={handleStopPuppeteerRecording}
                          className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium flex items-center justify-center gap-2"
                        >
                          <Save className="w-4 h-4" />
                          Stop Recording
                        </button>
                      )}

                      <button
                        onClick={handleExtractPuppeteer}
                        disabled={isLoading || puppeteer.isExecuting}
                        className="px-4 py-3 bg-primary text-primary-content rounded-lg hover:bg-primary/80 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        {puppeteer.isExecuting ? 'Extracting...' : 'Extract Transactions'}
                      </button>
                    </div>

                    {/* Close Browser */}
                    <button
                      onClick={handleClosePuppeteer}
                      className="w-full px-4 py-2 bg-base-200 text-base-content/80 rounded-lg hover:bg-base-300 font-medium text-sm"
                    >
                      Close Browser
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* AI Scrape */}
            {importMethod === 'ai-scrape' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-start gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                    <p className="text-purple-800 font-medium">AI-Powered Scraping with Ollama</p>
                  </div>
                  <ol className="text-purple-700 text-sm space-y-1 list-decimal list-inside">
                    <li>Complete Ollama setup below (one-time)</li>
                    <li>Click "Open AI Browser" and log in to your bank</li>
                    <li>Navigate to your transactions page</li>
                    <li>Click the "🤖 AI Scrape This Page" button</li>
                    <li>Ollama analyzes the HTML and extracts ALL transactions automatically</li>
                  </ol>
                  <p className="text-purple-600 text-xs mt-2">
                    💡 Free & private - runs entirely on your Mac. No API costs! Uses HTML analysis (no screenshots needed).
                  </p>
                </div>

                <OllamaSetup />

                <button
                  onClick={handleOpenAIScrape}
                  disabled={isLoading || !selectedAccount || !(ollamaStatus.installed && ollamaStatus.running && ollamaStatus.hasVisionModel)}
                  className="w-full px-6 py-12 border-2 border-dashed border-base-300 rounded-lg hover:border-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                >
                  <div className="flex flex-col items-center gap-3">
                    <Sparkles className="w-12 h-12 text-primary" />
                    <p className="text-base-content font-medium">Open AI Browser</p>
                    <p className="text-base-content/60 text-sm">
                      Smart extraction powered by Claude Vision
                    </p>
                  </div>
                </button>
              </div>
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

            {/* All Transactions */}
            <div>
              <h3 className="text-sm font-medium text-base-content/80 mb-2">
                Transactions to Import ({preview.rows.length} total)
              </h3>
              <div className="border border-base-300 rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  <table className="min-w-full divide-y divide-base-300">
                    <thead className="bg-base-200 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-base-content/60">#</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-base-content/60">Date</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-base-content/60">Description</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-base-content/60">Category</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-base-content/60">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-base-100 divide-y divide-base-300">
                      {preview.rows.map((row, i) => (
                        <tr key={i} className="hover:bg-base-200/50">
                          <td className="px-4 py-2 text-sm text-base-content/50">{i + 1}</td>
                          <td className="px-4 py-2 text-sm text-base-content whitespace-nowrap">{row.date}</td>
                          <td className="px-4 py-2 text-sm text-base-content">{row.description}</td>
                          <td className="px-4 py-2 text-sm text-base-content/70">{row.category || '-'}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium whitespace-nowrap">
                            <span className={row.amount < 0 ? 'text-red-600' : 'text-green-600'}>
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

      {/* Save Recipe Modal */}
      {showSaveRecipeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-base-100 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-base-content mb-4">Save Recording</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-base-content/80 mb-2">
                  Recipe Name *
                </label>
                <input
                  type="text"
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                  placeholder="e.g., USAA Transaction Download"
                  className="w-full px-4 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-base-content/80 mb-2">
                  Institution (Optional)
                </label>
                <input
                  type="text"
                  value={recipeInstitution}
                  onChange={(e) => setRecipeInstitution(e.target.value)}
                  placeholder="e.g., USAA"
                  className="w-full px-4 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-blue-800 text-sm">
                  <strong>Recorded:</strong> {puppeteer.recordedSteps.length} step{puppeteer.recordedSteps.length !== 1 ? 's' : ''}
                </p>
                <p className="text-blue-700 text-xs mt-1">
                  You can replay this recipe later to automate transaction extraction.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCancelSaveRecipe}
                className="flex-1 px-4 py-2 bg-base-200 text-base-content/80 rounded-lg hover:bg-base-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRecipe}
                disabled={!recipeName.trim()}
                className="flex-1 px-4 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary/80 disabled:opacity-50 font-medium"
              >
                Save Recipe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
