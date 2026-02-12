import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Zap, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../components/layout/PageHeader';
import { RecordingCard } from '../components/automation/RecordingCard';
import { EmptyState } from '../components/automation/EmptyState';
import { EditRecordingModal } from '../components/automation/EditRecordingModal';

interface Recording {
  id: string;
  name: string;
  institution?: string;
  url: string;
  steps: any[];
  created_at: string;
  updated_at: string;
}

export function Automation() {
  const navigate = useNavigate();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
  const [scrapedTransactions, setScrapedTransactions] = useState<any[] | null>(null);

  // New recording modal
  const [showNewRecordingModal, setShowNewRecordingModal] = useState(false);
  const [startUrl, setStartUrl] = useState('https://www.usaa.com');

  useEffect(() => {
    loadRecordings();

    // Listen for recording saved events
    const handleRecordingSaved = () => {
      loadRecordings();
      toast.success('Recording saved successfully');
    };

    // Listen for playback complete events
    const handlePlaybackComplete = () => {
      setPlayingId(null);
      toast.success('Automation completed successfully');
    };

    // Listen for scrape complete events
    const handleScrapeComplete = (...args: any[]) => {
      console.log('[Automation] handleScrapeComplete called');
      console.log('[Automation] Arguments received:', args);
      console.log('[Automation] Number of arguments:', args.length);
      console.log('[Automation] First arg (event):', args[0]);
      console.log('[Automation] Second arg (data):', args[1]);

      // The data should be the first argument (event is filtered by preload)
      const data = args[0];

      console.log('[Automation] Extracted data:', data);
      console.log('[Automation] Data type:', typeof data);

      if (!data) {
        console.error('[Automation] Scrape complete event received with undefined data');
        toast.error('Failed to receive scraped data');
        return;
      }

      if (!data.transactions || !Array.isArray(data.transactions)) {
        console.error('[Automation] Invalid transactions data:', data);
        toast.error('Invalid scraped data format');
        return;
      }

      console.log('[Automation] Setting scraped transactions:', data.transactions.length);
      setScrapedTransactions(data.transactions);

      if (data.count > 0) {
        toast.success(`Scraped ${data.count} transactions!`);
      } else {
        toast('No transactions found on page', { icon: 'ℹ️' });
      }
    };

    window.electron.on('automation:recording-saved', handleRecordingSaved);
    window.electron.on('automation:playback-complete', handlePlaybackComplete);
    window.electron.on('automation:scrape-complete', handleScrapeComplete);

    return () => {
      window.electron.removeListener('automation:recording-saved', handleRecordingSaved);
      window.electron.removeListener('automation:playback-complete', handlePlaybackComplete);
      window.electron.removeListener('automation:scrape-complete', handleScrapeComplete);
    };
  }, []);

  const loadRecordings = async () => {
    try {
      setLoading(true);
      const recipes = await window.electron.invoke('export-recipes:get-all');
      // Parse steps from JSON string to array
      const parsedRecipes = recipes.map((recipe: any) => ({
        ...recipe,
        steps: typeof recipe.steps === 'string' ? JSON.parse(recipe.steps) : recipe.steps
      }));
      setRecordings(parsedRecipes);
    } catch (error) {
      console.error('Failed to load recordings:', error);
      toast.error('Failed to load recordings');
    } finally {
      setLoading(false);
    }
  };

  const handleNewRecording = () => {
    setShowNewRecordingModal(true);
  };

  const handleStartRecording = async () => {
    try {
      setShowNewRecordingModal(false);
      toast.loading('Opening recording browser...', { duration: 1000 });

      const result = await window.electron.invoke('automation:start-recording', startUrl);

      if (result.success) {
        toast.success('Recording browser opened! Navigate, interact, then click "Start Recording".');
      } else {
        toast.error('Failed to open recording browser');
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording');
    }
  };

  const handlePlayRecording = async (id: string) => {
    const recording = recordings.find(r => r.id === id);
    if (!recording) return;

    try {
      setPlayingId(id);
      toast.loading('Starting playback...', { duration: 1000 });

      await window.electron.invoke('automation:play-recording', id);

      toast.success('Playback started! Watch the automation window.');
    } catch (error) {
      console.error('Failed to play recording:', error);
      toast.error('Failed to play recording');
      setPlayingId(null);
    }
  };

  const handleEditRecording = async (id: string, name: string, institution: string, steps?: any[]) => {
    try {
      await window.electron.invoke('export-recipes:update', {
        id,
        name,
        institution: institution || null,
        steps: steps
      });
      await loadRecordings();
      toast.success('Recording updated successfully');
    } catch (error) {
      console.error('Failed to update recording:', error);
      toast.error('Failed to update recording');
    }
  };

  const handleDeleteRecording = async (id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this recording? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await window.electron.invoke('export-recipes:delete', id);
      await loadRecordings();
      toast.success('Recording deleted successfully');
    } catch (error) {
      console.error('Failed to delete recording:', error);
      toast.error('Failed to delete recording');
    }
  };

  const handleDuplicateRecording = async (id: string) => {
    try {
      const original = recordings.find(r => r.id === id);
      if (!original) return;

      await window.electron.invoke('export-recipes:create', {
        name: `${original.name} (Copy)`,
        institution: original.institution || null,
        url: original.url,
        steps: JSON.stringify(original.steps)
      });
      await loadRecordings();
      toast.success('Recording duplicated successfully');
    } catch (error) {
      console.error('Failed to duplicate recording:', error);
      toast.error('Failed to duplicate recording');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Automation"
        subtitle="Record and replay browser interactions with real browser (undetectable)"
        action={
          <button className="btn btn-primary gap-2" onClick={handleNewRecording}>
            <Plus className="w-4 h-4" />
            New Recording
          </button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : recordings.length === 0 ? (
          <EmptyState onCreateNew={handleNewRecording} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recordings.map((recording) => (
              <RecordingCard
                key={recording.id}
                recording={recording}
                onPlay={handlePlayRecording}
                onEdit={(rec) => setEditingRecording(rec)}
                onDelete={handleDeleteRecording}
                onDuplicate={handleDuplicateRecording}
                isPlaying={playingId === recording.id}
              />
            ))}
          </div>
        )}
      </div>

      <EditRecordingModal
        isOpen={!!editingRecording}
        recording={editingRecording}
        onSave={handleEditRecording}
        onClose={() => setEditingRecording(null)}
      />

      {/* Scraped Transactions Modal */}
      {scrapedTransactions && scrapedTransactions.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-base-100 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-base-300">
              <h3 className="text-xl font-bold text-base-content">
                Scraped Transactions ({scrapedTransactions.length})
              </h3>
              <p className="text-sm text-base-content/70 mt-1">
                Review the extracted transactions below
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Category</th>
                      <th>Amount</th>
                      <th>Balance</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scrapedTransactions.map((txn, idx) => (
                      <tr key={idx}>
                        <td>{txn.index || idx + 1}</td>
                        <td className="whitespace-nowrap">{txn.date}</td>
                        <td className="max-w-xs truncate">{txn.description}</td>
                        <td className="whitespace-nowrap">
                          {txn.category ? (
                            <span className="badge badge-sm badge-primary">{txn.category}</span>
                          ) : (
                            <span className="text-base-content/40 text-xs">No category</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap font-mono">{txn.amount}</td>
                        <td className="whitespace-nowrap font-mono">{txn.balance}</td>
                        <td>
                          <span className={`badge badge-sm ${
                            txn.confidence > 50 ? 'badge-success' :
                            txn.confidence > 30 ? 'badge-warning' :
                            'badge-error'
                          }`}>
                            {txn.confidence ? Math.round(txn.confidence) : '?'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-base-300 bg-base-200">
              <button
                onClick={() => setScrapedTransactions(null)}
                className="flex-1 px-4 py-2 bg-base-300 text-base-content rounded-lg hover:bg-base-400 font-medium"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  // Copy as JSON to clipboard
                  navigator.clipboard.writeText(JSON.stringify(scrapedTransactions, null, 2));
                  toast.success('Copied to clipboard!');
                }}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
              >
                Copy as JSON
              </button>
              <button
                onClick={() => {
                  // TODO: Import to database
                  toast.info('Import feature coming soon!');
                }}
                className="flex-1 px-4 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary/80 font-medium"
              >
                Import Transactions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Recording Modal */}
      {showNewRecordingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-base-100 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-xl font-bold text-base-content mb-4">Start New Recording</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-base-content/80 mb-2">
                  Starting URL
                </label>
                <input
                  type="url"
                  value={startUrl}
                  onChange={(e) => setStartUrl(e.target.value)}
                  placeholder="https://www.usaa.com"
                  className="w-full px-4 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  autoFocus
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-900 font-medium text-sm mb-2">How it works:</p>
                <ol className="text-blue-700 text-xs space-y-1 list-decimal list-inside">
                  <li>Opens a real browser window (undetectable by banks)</li>
                  <li>Navigate to your bank and log in manually</li>
                  <li>Click "Start Recording" when ready</li>
                  <li>Perform your actions (navigate, click, type)</li>
                  <li>Click "Stop & Save" when done</li>
                  <li>Your recording can be replayed anytime!</li>
                </ol>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-800 text-sm">
                  <strong>✓ Uses real Chromium browser</strong>
                </p>
                <p className="text-green-700 text-xs mt-1">
                  Cookies and sessions persist between recordings, so you stay logged in!
                </p>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <p className="text-purple-800 text-sm">
                  <strong>🔒 Fully Automated</strong>
                </p>
                <p className="text-purple-700 text-xs mt-1">
                  All inputs including PINs and passwords are saved during recording and automatically entered during playback. No manual intervention needed!
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewRecordingModal(false)}
                className="flex-1 px-4 py-2 bg-base-200 text-base-content/80 rounded-lg hover:bg-base-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleStartRecording}
                className="flex-1 px-4 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary/80 font-medium"
              >
                Open Recording Browser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
