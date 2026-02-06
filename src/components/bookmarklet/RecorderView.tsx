import { useState, useEffect } from 'react';
import { Play, Square, RotateCcw, Globe, Copy, Check, Download, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStore } from '../../store';
import { useNavigate } from 'react-router-dom';

export default function RecorderView() {
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [downloadedFile, setDownloadedFile] = useState<{ filePath: string; fileName: string } | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const { accounts, loadAccounts } = useStore();
  const navigate = useNavigate();

  // Fetch accounts on mount
  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    // Listen for CSV download events from the embedded browser
    const handleDownload = (data: { filePath: string; fileName: string }) => {
      console.log('[RecorderView] CSV downloaded:', data);
      setDownloadedFile(data);
      toast.success(`${data.fileName} downloaded! Select an account to import.`);
    };

    window.electron.on('csv:downloaded', handleDownload);

    return () => {
      window.electron.removeListener('csv:downloaded', handleDownload);
    };
  }, []);

  const openBrowser = async () => {
    if (!url) return;

    try {
      // Open embedded browser window
      await window.electron.invoke('recorder:start', url);
      setIsBrowserOpen(true);
      toast.success('Browser opened! Log in and export your CSV.');
    } catch (error) {
      console.error('Failed to open browser:', error);
      toast.error('Failed to open browser. Please try again.');
    }
  };

  const closeBrowser = async () => {
    try {
      await window.electron.invoke('recorder:stop');
      setIsBrowserOpen(false);
    } catch (error) {
      console.error('Failed to close browser:', error);
    }
  };

  const handleImport = async () => {
    if (!downloadedFile || !selectedAccountId) return;

    try {
      // Detect format
      const format = await window.electron.invoke('import:detect-format', downloadedFile.filePath);

      if (!format) {
        toast.error('Could not detect CSV format. Please use manual import.');
        return;
      }

      // Navigate to import page with file path and account
      navigate('/import', {
        state: {
          filePath: downloadedFile.filePath,
          accountId: selectedAccountId,
          format,
        },
      });

      toast.success('Starting import...');
      setDownloadedFile(null);
      setSelectedAccountId(null);
    } catch (error) {
      console.error('Failed to start import:', error);
      toast.error('Failed to start import. Please try manual import.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="card bg-info/10 border border-info/20">
        <div className="card-body">
          <h3 className="font-semibold text-info mb-2">🌐 Browser Mode:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-base-content/80">
            <li><strong>Enter your bank's URL</strong> below (or any starting page)</li>
            <li><strong>Click "Open Browser"</strong> - a browser window will open</li>
            <li><strong>Navigate and log in</strong> to your bank normally</li>
            <li><strong>Export your CSV</strong> as you normally would</li>
            <li><strong>CSV auto-detected!</strong> Select which account to import to</li>
            <li>The import process starts automatically</li>
          </ol>
          <div className="alert alert-info mt-4">
            <span className="text-sm">
              💡 <strong>Tip:</strong> The browser is configured to work with most banks. If you encounter issues, try using your bank's main URL and navigating from there.
            </span>
          </div>
        </div>
      </div>

      {/* URL Input and Controls */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <h3 className="card-title text-base mb-4">Open Browser</h3>

          <div className="flex gap-2">
            <div className="form-control flex-1">
              <input
                type="url"
                placeholder="https://your-bank.com"
                className="input input-bordered"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isBrowserOpen}
              />
            </div>
            <button
              className={`btn ${isBrowserOpen ? 'btn-error' : 'btn-primary'} gap-2`}
              onClick={isBrowserOpen ? closeBrowser : openBrowser}
              disabled={!url && !isBrowserOpen}
            >
              {isBrowserOpen ? (
                <>
                  <Square className="w-4 h-4" />
                  Close Browser
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4" />
                  Open Browser
                </>
              )}
            </button>
          </div>

          {isBrowserOpen && (
            <div className="alert alert-success mt-4">
              <Globe className="w-5 h-5" />
              <div>
                <p className="font-semibold">✅ Browser is open</p>
                <p className="text-sm">
                  Navigate to your bank, log in, and export your CSV.
                  We'll automatically detect when the download starts!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSV Import Modal */}
      {downloadedFile && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-success" />
              CSV Downloaded!
            </h3>

            <div className="alert alert-success mb-4">
              <FileText className="w-5 h-5" />
              <span>{downloadedFile.fileName}</span>
            </div>

            <p className="mb-4 text-sm text-base-content/70">
              Select which account to import these transactions to:
            </p>

            <div className="form-control mb-6">
              <select
                className="select select-bordered"
                value={selectedAccountId || ''}
                onChange={(e) => setSelectedAccountId(Number(e.target.value))}
              >
                <option value="">Select an account...</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.institution})
                  </option>
                ))}
              </select>
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setDownloadedFile(null);
                  setSelectedAccountId(null);
                }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={!selectedAccountId}
              >
                Start Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
