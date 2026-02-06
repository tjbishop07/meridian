import { useState } from 'react';
import { Code2, Copy, Check, HelpCircle, Edit3, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import RecorderView from '../components/bookmarklet/RecorderView';

type Mode = 'manual' | 'browser';

export default function BookmarkletBuilder() {
  const [mode, setMode] = useState<Mode>('manual');
  const [bankName, setBankName] = useState('');
  const [startDateSelector, setStartDateSelector] = useState('');
  const [endDateSelector, setEndDateSelector] = useState('');
  const [exportButtonSelector, setExportButtonSelector] = useState('');
  const [formatSelector, setFormatSelector] = useState('');
  const [waitTime, setWaitTime] = useState('500');
  const [copied, setCopied] = useState(false);

  const generateBookmarklet = () => {
    const code = `
(function() {
  try {
    ${startDateSelector ? `
    // Set start date
    const startDate = document.querySelector('${startDateSelector}');
    if (startDate) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      startDate.value = thirtyDaysAgo.toISOString().split('T')[0];
      startDate.dispatchEvent(new Event('change', { bubbles: true }));
    }
    ` : ''}
    ${endDateSelector ? `
    // Set end date
    const endDate = document.querySelector('${endDateSelector}');
    if (endDate) {
      endDate.value = new Date().toISOString().split('T')[0];
      endDate.dispatchEvent(new Event('change', { bubbles: true }));
    }
    ` : ''}
    ${formatSelector ? `
    // Set format to CSV
    const format = document.querySelector('${formatSelector}');
    if (format) {
      format.value = 'csv';
      format.dispatchEvent(new Event('change', { bubbles: true }));
    }
    ` : ''}
    ${exportButtonSelector ? `
    // Click export button after a short delay
    setTimeout(function() {
      const exportBtn = document.querySelector('${exportButtonSelector}');
      if (exportBtn) {
        exportBtn.click();
        alert('Export started for ${bankName || 'your bank'}!');
      } else {
        alert('Could not find export button. Check the selector.');
      }
    }, ${waitTime});
    ` : ''}
  } catch (e) {
    alert('Error: ' + e.message);
    console.error(e);
  }
})();
    `.trim();

    return `javascript:${encodeURIComponent(code)}`;
  };

  const copyToClipboard = () => {
    const bookmarklet = generateBookmarklet();
    navigator.clipboard.writeText(bookmarklet);
    setCopied(true);
    toast.success('Bookmarklet copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const hasRequiredFields = exportButtonSelector.trim() !== '';

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-base-content mb-2">Bookmarklet Builder</h1>
        <p className="text-base-content/70">
          Create a custom bookmarklet to automate CSV exports from your bank website
        </p>
      </div>

      {/* Mode Selector */}
      <div className="tabs tabs-boxed mb-8 inline-flex">
        <button
          className={`tab gap-2 ${mode === 'manual' ? 'tab-active' : ''}`}
          onClick={() => setMode('manual')}
        >
          <Edit3 className="w-4 h-4" />
          Manual Mode
        </button>
        <button
          className={`tab gap-2 ${mode === 'browser' ? 'tab-active' : ''}`}
          onClick={() => setMode('browser')}
        >
          <Globe className="w-4 h-4" />
          Browser Mode
        </button>
      </div>

      {mode === 'browser' ? (
        <RecorderView />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Form */}
        <div className="space-y-6">
          <div className="bg-info/10 border border-info/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
              <div className="text-sm text-base-content/80">
                <p className="font-semibold mb-2">How to find selectors:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to your bank's export page</li>
                  <li>Right-click on an element → "Inspect"</li>
                  <li>Find the <code className="bg-base-300 px-1 rounded">id</code> or <code className="bg-base-300 px-1 rounded">class</code></li>
                  <li>Use <code className="bg-base-300 px-1 rounded">#id</code> or <code className="bg-base-300 px-1 rounded">.class</code> format</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-lg mb-4">Configuration</h2>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Bank Name (optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Chase, Bank of America"
                  className="input input-bordered"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Start Date Selector (optional)</span>
                  <span className="label-text-alt">Auto-fills 30 days ago</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., #startDate or .date-from"
                  className="input input-bordered font-mono text-sm"
                  value={startDateSelector}
                  onChange={(e) => setStartDateSelector(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">End Date Selector (optional)</span>
                  <span className="label-text-alt">Auto-fills today</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., #endDate or .date-to"
                  className="input input-bordered font-mono text-sm"
                  value={endDateSelector}
                  onChange={(e) => setEndDateSelector(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Export Button Selector <span className="text-error">*</span></span>
                  <span className="label-text-alt">Required</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., #exportBtn or .btn-export"
                  className="input input-bordered font-mono text-sm"
                  value={exportButtonSelector}
                  onChange={(e) => setExportButtonSelector(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Format Dropdown Selector (optional)</span>
                  <span className="label-text-alt">Sets to CSV</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., #format or select[name='format']"
                  className="input input-bordered font-mono text-sm"
                  value={formatSelector}
                  onChange={(e) => setFormatSelector(e.target.value)}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Wait Time (ms)</span>
                  <span className="label-text-alt">Delay before clicking export</span>
                </label>
                <input
                  type="number"
                  placeholder="500"
                  className="input input-bordered"
                  value={waitTime}
                  onChange={(e) => setWaitTime(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Preview & Instructions */}
        <div className="space-y-6">
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-lg mb-4">Generated Bookmarklet</h2>

              {!hasRequiredFields ? (
                <div className="alert alert-warning">
                  <span>Fill in the Export Button Selector to generate a bookmarklet</span>
                </div>
              ) : (
                <>
                  <div className="bg-base-200 p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-64 overflow-y-auto">
                    <code>{generateBookmarklet()}</code>
                  </div>

                  <button
                    className="btn btn-primary gap-2"
                    onClick={copyToClipboard}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Bookmarklet
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="card bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-lg mb-4">Installation Instructions</h2>

              <div className="space-y-4 text-sm">
                <div>
                  <div className="font-semibold mb-2">Step 1: Create Bookmark</div>
                  <ol className="list-decimal list-inside space-y-1 text-base-content/70">
                    <li>Click "Copy Bookmarklet" above</li>
                    <li>Create a new bookmark in your browser</li>
                    <li>Name it: "Export {bankName || 'Bank'} CSV"</li>
                    <li>Paste the bookmarklet code as the URL</li>
                  </ol>
                </div>

                <div className="divider"></div>

                <div>
                  <div className="font-semibold mb-2">Step 2: Use It</div>
                  <ol className="list-decimal list-inside space-y-1 text-base-content/70">
                    <li>Log into your bank website</li>
                    <li>Navigate to the export/download page</li>
                    <li>Click your new bookmark</li>
                    <li>Watch it auto-fill and export!</li>
                  </ol>
                </div>

                <div className="divider"></div>

                <div>
                  <div className="font-semibold mb-2">Step 3: Import</div>
                  <p className="text-base-content/70">
                    Once the CSV downloads, go to the Import page and select the file,
                    or drag it directly into the app if you have drag & drop enabled.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-success/10 border border-success/20">
            <div className="card-body">
              <h3 className="font-semibold text-success mb-2">💡 Pro Tip</h3>
              <p className="text-sm text-base-content/70">
                Combine this with the Folder Watcher feature (Settings → Import) to automatically
                import new CSVs. Set your browser to download to a watched folder, click your
                bookmarklet, and the import happens automatically!
              </p>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
