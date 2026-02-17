import { Play, Pencil, Copy, Trash2 } from 'lucide-react';

interface Recording {
  id: string;
  name: string;
  institution?: string;
  url: string;
  steps: any[];
  account_id?: number | null;
  account_name?: string;
  created_at: string;
  updated_at: string;
  last_run_at?: string | null;
  last_scraping_method?: string | null;
}

interface RecordingCardProps {
  recording: Recording;
  onPlay: (id: string) => void;
  onEdit: (recording: Recording) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  isPlaying?: boolean;
  progress?: {
    currentStep: number;
    totalSteps: number;
    status: string;
    color: string;
  };
}

export function RecordingCard({
  recording,
  onPlay,
  onEdit,
  onDelete,
  onDuplicate,
  isPlaying = false,
  progress
}: RecordingCardProps) {
  console.log('[RecordingCard]', recording.name, '- isPlaying:', isPlaying, '- progress:', progress);

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch {
      return 'https://www.google.com/s2/favicons?domain=example.com&sz=32';
    }
  };

  const formatLastRunTime = (dateStr: string) => {
    // SQLite stores timestamps in UTC as 'YYYY-MM-DD HH:MM:SS'
    // We need to explicitly treat it as UTC and convert to local time
    let date: Date;

    if (dateStr.includes('T') || dateStr.includes('Z')) {
      // Already in ISO format with timezone info
      date = new Date(dateStr);
    } else {
      // SQLite format without timezone - treat as UTC
      date = new Date(dateStr + ' UTC');
    }

    // Get current time in user's local timezone
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    // Format time in user's local timezone
    const timeStr = date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    if (isToday) {
      return `Today at ${timeStr}`;
    } else if (isYesterday) {
      return `Yesterday at ${timeStr}`;
    } else {
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      }) + ` at ${timeStr}`;
    }
  };

  return (
    <tr className={`hover:bg-base-200 transition-colors ${isPlaying ? 'bg-primary/5' : ''}`} style={{ position: 'relative' }}>
      {/* Name */}
      <td className="whitespace-nowrap">
        <div className="flex items-center gap-2">
          <img
            src={getFaviconUrl(recording.url)}
            className="w-4 h-4"
            alt=""
            onError={(e) => {
              e.currentTarget.src = 'https://www.google.com/s2/favicons?domain=example.com&sz=32';
            }}
          />
          <span className="font-medium text-base-content">{recording.name}</span>
          {recording.institution && (
            <span className="badge badge-primary badge-sm">{recording.institution}</span>
          )}
        </div>
      </td>

      {/* Account */}
      <td>
        {recording.account_name ? (
          <span className="badge badge-success badge-sm">{recording.account_name}</span>
        ) : (
          <span className="badge badge-ghost badge-sm">No account</span>
        )}
      </td>

      {/* Steps */}
      <td className="text-sm text-base-content/70 text-center">
        {recording.steps.length}
      </td>

      {/* Last Run */}
      <td className="text-sm">
        {recording.last_run_at ? (
          <span className="text-success">{formatLastRunTime(recording.last_run_at)}</span>
        ) : (
          <span className="text-warning">Never run</span>
        )}
      </td>

      {/* Status/Progress */}
      <td>
        {isPlaying ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium" style={{ color: progress?.color || '#3b82f6' }}>
                {progress?.status || 'Starting...'}
              </span>
              <span className="text-base-content/60">
                {progress?.currentStep || 0}/{progress?.totalSteps || recording.steps.length}
              </span>
            </div>
            {progress && progress.currentStep >= progress.totalSteps ? (
              <progress className="progress progress-primary w-full h-1"></progress>
            ) : (
              <progress
                className="progress progress-primary w-full h-1"
                value={progress?.currentStep || 0}
                max={progress?.totalSteps || recording.steps.length}
              ></progress>
            )}
          </div>
        ) : (
          <span className="text-xs text-base-content/60">Ready</span>
        )}
      </td>

      {/* Actions */}
      <td>
        <div className="flex items-center justify-end gap-1">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onPlay(recording.id)}
            disabled={isPlaying}
          >
            {!isPlaying && <Play className="w-4 h-4" />}
            {isPlaying ? 'Running...' : 'Run'}
          </button>

          <button
            className="btn btn-ghost btn-sm btn-circle"
            onClick={() => onEdit(recording)}
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>

          <button
            className="btn btn-ghost btn-sm btn-circle"
            onClick={() => onDuplicate(recording.id)}
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>

          <button
            className="btn btn-ghost btn-sm btn-circle text-error hover:bg-error/10"
            onClick={() => onDelete(recording.id)}
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
