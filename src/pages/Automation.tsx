import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
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
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
  const [sensitiveInputRequest, setSensitiveInputRequest] = useState<SensitiveInputRequest | null>(null);

  useEffect(() => {
    loadRecordings();

    // Listen for recording saved events
    const handleRecordingSaved = () => {
      loadRecordings();
      showToast('Recording saved successfully', 'success');
    };

    // Listen for playback complete events
    const handlePlaybackComplete = () => {
      setPlayingId(null);
      showToast('Automation completed successfully', 'success');
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
      showToast('Failed to load recordings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNewRecording = async () => {
    try {
      // Open window with Google as starting page - user can navigate from there
      await window.electron.invoke('automation:start-recording', 'https://www.google.com');
    } catch (error) {
      console.error('Failed to start recording:', error);
      showToast('Failed to start recording', 'error');
    }
  };

  const handlePlayRecording = async (id: string) => {
    try {
      setPlayingId(id);
      await window.electron.invoke('automation:play-recording', id);
    } catch (error) {
      console.error('Failed to play recording:', error);
      showToast('Failed to play recording', 'error');
      setPlayingId(null);
    }
  };

  const handleEditRecording = async (id: string, name: string, institution: string) => {
    try {
      await window.electron.invoke('export-recipes:update', {
        id,
        name,
        institution: institution || null
      });
      await loadRecordings();
      showToast('Recording updated successfully', 'success');
    } catch (error) {
      console.error('Failed to update recording:', error);
      showToast('Failed to update recording', 'error');
    }
  };

  const handleDeleteRecording = async (id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this recording? This action cannot be undone.');
    if (!confirmed) return;

    try {
      await window.electron.invoke('export-recipes:delete', id);
      await loadRecordings();
      showToast('Recording deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete recording:', error);
      showToast('Failed to delete recording', 'error');
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
      showToast('Recording duplicated successfully', 'success');
    } catch (error) {
      console.error('Failed to duplicate recording:', error);
      showToast('Failed to duplicate recording', 'error');
    }
  };

  const handleSensitiveInputSubmit = async (value: string) => {
    try {
      await window.electron.invoke('automation:provide-sensitive-input', value);
      setSensitiveInputRequest(null);
    } catch (error) {
      console.error('Failed to provide sensitive input:', error);
      showToast('Failed to provide input', 'error');
    }
  };

  const handleSensitiveInputCancel = () => {
    setSensitiveInputRequest(null);
    setPlayingId(null);
    // TODO: Send cancel signal to playback window
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    // Simple toast implementation - could be enhanced with a proper toast library
    const toast = document.createElement('div');
    toast.className = `alert alert-${type === 'success' ? 'success' : 'error'} fixed bottom-4 right-4 w-auto shadow-lg z-50`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Automation"
        subtitle="Record and replay browser interactions"
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
    </div>
  );
}
