import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Zap, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../components/layout/PageHeader';
import { RecordingCard } from '../components/automation/RecordingCard';
import { EmptyState } from '../components/automation/EmptyState';
import { SensitiveInputModal } from '../components/automation/SensitiveInputModal';
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

interface SensitiveInputRequest {
  stepNumber: number;
  totalSteps: number;
  fieldLabel: string;
}

export function Automation() {
  const navigate = useNavigate();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
  const [sensitiveInputRequest, setSensitiveInputRequest] = useState<SensitiveInputRequest | null>(null);

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

    // Listen for sensitive input requests
    const handleSensitiveInputNeeded = (_: any, data: SensitiveInputRequest) => {
      setSensitiveInputRequest(data);
    };

    window.electron.on('automation:recording-saved', handleRecordingSaved);
    window.electron.on('automation:playback-complete', handlePlaybackComplete);
    window.electron.on('automation:playback-needs-input', handleSensitiveInputNeeded);

    return () => {
      window.electron.removeListener('automation:recording-saved', handleRecordingSaved);
      window.electron.removeListener('automation:playback-complete', handlePlaybackComplete);
      window.electron.removeListener('automation:playback-needs-input', handleSensitiveInputNeeded);
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

  const handleSensitiveInputSubmit = async (value: string) => {
    try {
      await window.electron.invoke('automation:provide-sensitive-input', value);
      setSensitiveInputRequest(null);
    } catch (error) {
      console.error('Failed to provide sensitive input:', error);
      toast.error('Failed to provide input');
    }
  };

  const handleSensitiveInputCancel = () => {
    setSensitiveInputRequest(null);
    setPlayingId(null);
    // TODO: Send cancel signal to playback window
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

      <SensitiveInputModal
        isOpen={!!sensitiveInputRequest}
        stepNumber={sensitiveInputRequest?.stepNumber || 0}
        totalSteps={sensitiveInputRequest?.totalSteps || 0}
        fieldLabel={sensitiveInputRequest?.fieldLabel || ''}
        onSubmit={handleSensitiveInputSubmit}
        onCancel={handleSensitiveInputCancel}
      />

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
                  <strong>🔒 PINs & Passwords Auto-Saved</strong>
                </p>
                <p className="text-purple-700 text-xs mt-1">
                  Enter your PIN/password once during recording - it'll be saved and automatically entered during playback! Look for the "🔒 Saved" indicator.
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
