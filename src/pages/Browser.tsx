import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Home, Download, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStore } from '../store';
import { useNavigate } from 'react-router-dom';

export default function Browser() {
  const [url, setUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBrowserAttached, setIsBrowserAttached] = useState(false);
  const [downloadedFile, setDownloadedFile] = useState<{ filePath: string; fileName: string } | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const processedDownloads = useRef<Set<string>>(new Set());
  const isProcessingDownload = useRef(false);

  const { accounts, loadAccounts } = useStore();
  const navigate = useNavigate();

  // Fetch accounts on mount
  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Save current URL to settings whenever it changes
  useEffect(() => {
    if (currentUrl && currentUrl !== 'about:blank') {
      window.electron.invoke('settings:set', {
        key: 'browser:lastUrl',
        value: currentUrl,
      }).catch(error => {
        console.error('Failed to save last URL:', error);
      });
    }
  }, [currentUrl]);

  // Attach or show browser on mount
  useEffect(() => {
    const initBrowser = async () => {
      try {
        // Try to show existing browser first
        const showResult = await window.electron.invoke('browser:show');

        if (showResult.success) {
          console.log('[Browser] Showed existing browser view');
          setIsBrowserAttached(true);

          // Load current URL from settings
          const lastUrl = await window.electron.invoke('settings:get', 'browser:lastUrl');
          if (lastUrl) {
            setUrl(lastUrl);
            setCurrentUrl(lastUrl);
          }
        } else {
          // Browser doesn't exist yet - create it
          console.log('[Browser] Creating new browser view');
          const lastUrl = await window.electron.invoke('settings:get', 'browser:lastUrl');
          const initialUrl = lastUrl || 'about:blank';

          const attachResult = await window.electron.invoke('browser:attach', initialUrl);

          if (attachResult.success) {
            setIsBrowserAttached(true);

            if (lastUrl) {
              setUrl(lastUrl);
              setCurrentUrl(lastUrl);
            }
          } else {
            console.error('Failed to attach browser');
            toast.error('Failed to load browser');
          }
        }
      } catch (error) {
        console.error('Failed to initialize browser:', error);
        toast.error('Failed to load browser');
      }
    };

    initBrowser();

    // Listen for URL changes
    const handleUrlChange = (newUrl: string) => {
      setCurrentUrl(newUrl);
      setUrl(newUrl);
    };

    const handleLoading = (loading: boolean) => {
      setIsLoading(loading);
    };

    const handleDownload = (data: { filePath: string; fileName: string }) => {
      console.log('[Browser] CSV downloaded:', data);

      // Prevent duplicate processing
      if (isProcessingDownload.current || processedDownloads.current.has(data.filePath)) {
        console.log('[Browser] Ignoring duplicate download event');
        return;
      }

      isProcessingDownload.current = true;
      processedDownloads.current.add(data.filePath);

      setDownloadedFile(data);

      // Hide browser view so modal is visible
      window.electron.invoke('browser:hide').catch(err => {
        console.error('Failed to hide browser for modal:', err);
      });

      // Reset processing flag after a short delay
      setTimeout(() => {
        isProcessingDownload.current = false;
      }, 1000);
    };

    const handleError = (error: { code: number; description: string; url: string }) => {
      console.error('[Browser] Navigation error:', error);
      // Only show error for significant issues (not cancelled loads)
      if (error.code !== -3) {
        toast.error(`Failed to load page: ${error.description}`);
      }
    };

    window.electron.on('browser:url-changed', handleUrlChange);
    window.electron.on('browser:loading', handleLoading);
    window.electron.on('csv:downloaded', handleDownload);
    window.electron.on('browser:error', handleError);

    // Cleanup on unmount - hide browser instead of destroying it
    return () => {
      console.log('[Browser] Component unmounting, hiding browser view');
      window.electron.removeListener('browser:url-changed', handleUrlChange);
      window.electron.removeListener('browser:loading', handleLoading);
      window.electron.removeListener('csv:downloaded', handleDownload);
      window.electron.removeListener('browser:error', handleError);

      // Hide browser view (keep it alive for next visit)
      window.electron.invoke('browser:hide').catch(err => {
        console.error('Failed to hide browser:', err);
      });
    };
  }, []);

  const handleNavigate = async (targetUrl?: string) => {
    if (!isBrowserAttached) {
      toast.error('Browser is not ready yet');
      return;
    }

    const urlToLoad = targetUrl || url;
    if (!urlToLoad || urlToLoad.trim() === '') {
      return;
    }

    // Add https:// if no protocol specified
    let finalUrl = urlToLoad;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://') && !finalUrl.startsWith('about:')) {
      finalUrl = 'https://' + finalUrl;
    }

    try {
      await window.electron.invoke('browser:navigate', finalUrl);
      setCurrentUrl(finalUrl);
      setUrl(finalUrl);
    } catch (error) {
      console.error('Failed to navigate:', error);
      toast.error('Failed to load page');
    }
  };

  const handleBack = async () => {
    await window.electron.invoke('browser:back');
  };

  const handleForward = async () => {
    await window.electron.invoke('browser:forward');
  };

  const handleReload = async () => {
    await window.electron.invoke('browser:reload');
  };

  const handleHome = () => {
    handleNavigate('https://google.com');
  };

  const handleImport = async () => {
    if (!downloadedFile || !selectedAccountId) return;

    try {
      // Detect format
      const format = await window.electron.invoke('import:detect-format', downloadedFile.filePath);

      if (!format) {
        toast.error('Could not detect CSV format. Please use manual import.');
        // Show browser again since we're staying on this page
        window.electron.invoke('browser:show');
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
      // Browser will be hidden by cleanup since we're navigating away
    } catch (error) {
      console.error('Failed to start import:', error);
      toast.error('Failed to start import. Please try manual import.');
      // Show browser again since we're staying on this page
      window.electron.invoke('browser:show');
    }
  };

  const handleCancelImport = () => {
    setDownloadedFile(null);
    setSelectedAccountId(null);

    // Show browser again
    window.electron.invoke('browser:show').catch(err => {
      console.error('Failed to show browser:', err);
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Address Bar */}
      <div className="bg-base-200 p-3">
        <div className="flex items-center gap-2">
          {/* Navigation buttons */}
          <div className="flex gap-1">
            <button
              className="btn btn-sm btn-ghost"
              onClick={handleBack}
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={handleForward}
              title="Forward"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={handleReload}
              title="Reload"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={handleHome}
              title="Home"
            >
              <Home className="w-4 h-4" />
            </button>
          </div>

          {/* URL input */}
          <input
            type="text"
            className="input input-sm input-bordered flex-1 font-mono text-xs"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleNavigate();
              }
            }}
            placeholder="Enter URL (e.g., bankofamerica.com) and press Enter"
          />
        </div>

        {/* Info banner */}
        <div className="alert alert-info mt-3 py-2 rounded-none -mx-3 -mb-3">
          <span className="text-xs">
            💡 Navigate to your bank, log in, and export your CSV. We'll automatically detect the download!
          </span>
        </div>
      </div>

      {/* Browser content area - BrowserView is overlaid here by Electron */}
      <div className="flex-1 bg-base-300 relative">
        {!isBrowserAttached && (
          <div className="absolute inset-0 flex items-center justify-center text-base-content/50">
            <div className="text-center">
              <div className="loading loading-spinner loading-lg mb-4"></div>
              <p>Loading browser...</p>
            </div>
          </div>
        )}
        {isBrowserAttached && (
          <div className="absolute inset-0 flex items-center justify-center text-base-content/30 pointer-events-none">
            <p className="text-xs">Browser view active</p>
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      {downloadedFile && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-success" />
              Download Detected!
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
                onClick={handleCancelImport}
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
