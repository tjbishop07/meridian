import { Play, MoreVertical, Pencil, Copy, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  console.log('[RecordingCard]', recording.name, '- isPlaying:', isPlaying, '- progress:', progress);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

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
    <div className={`card bg-base-100 shadow-lg hover:shadow-xl transition-all ${isPlaying ? 'ring-2 ring-primary' : ''}`}>
      <div className="card-body">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <img
              src={getFaviconUrl(recording.url)}
              className="w-4 h-4"
              alt=""
              onError={(e) => {
                e.currentTarget.src = 'https://www.google.com/s2/favicons?domain=example.com&sz=32';
              }}
            />
            <h3 className="card-title text-base">{recording.name}</h3>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-base-200 ring-1 ring-base-300 z-50">
                <div className="py-1">
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-base-300"
                    onClick={() => {
                      onEdit(recording);
                      setMenuOpen(false);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-base-300"
                    onClick={() => {
                      onDuplicate(recording.id);
                      setMenuOpen(false);
                    }}
                  >
                    <Copy className="w-4 h-4" />
                    Duplicate
                  </button>
                  <button
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-error hover:text-error-content text-error"
                    onClick={() => {
                      onDelete(recording.id);
                      setMenuOpen(false);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {recording.institution && (
            <span className="badge badge-primary badge-sm">{recording.institution}</span>
          )}
          {recording.account_name && (
            <span className="badge badge-success badge-sm">→ {recording.account_name}</span>
          )}
          {!recording.account_name && (
            <span className="badge badge-ghost badge-sm">No account</span>
          )}
          {recording.last_scraping_method && (
            <span className={`badge badge-sm ${
              recording.last_scraping_method === 'claude' ? 'badge-info' :
              recording.last_scraping_method === 'ollama' ? 'badge-accent' :
              'badge-neutral'
            }`}>
              {recording.last_scraping_method === 'claude' ? '🤖 Claude Vision' :
               recording.last_scraping_method === 'ollama' ? '🏠 Local AI' :
               '📄 DOM'}
            </span>
          )}
        </div>

        <div className="flex gap-4 text-sm text-base-content/70">
          <span>{recording.steps.length} steps</span>
          {recording.last_run_at ? (
            <span className="text-success">Last run: {formatLastRunTime(recording.last_run_at)}</span>
          ) : (
            <span className="text-warning">Never run</span>
          )}
        </div>

        {/* Progress Display */}
        {isPlaying && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium" style={{ color: progress?.color || '#3b82f6' }}>
                {progress?.status || 'Starting automation...'}
              </span>
              <span className="text-base-content/60">
                {progress?.currentStep || 0}/{progress?.totalSteps || recording.steps.length}
              </span>
            </div>
            {progress && progress.currentStep >= progress.totalSteps ? (
              // Indeterminate progress bar for scraping phase (DaisyUI)
              <progress className="progress progress-primary w-full"></progress>
            ) : (
              // Normal progress bar for steps
              <progress
                className="progress progress-primary w-full"
                value={progress?.currentStep || 0}
                max={progress?.totalSteps || recording.steps.length}
              ></progress>
            )}
          </div>
        )}

        <div className="card-actions justify-end mt-4">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onPlay(recording.id)}
            disabled={isPlaying}
          >
            {!isPlaying && <Play className="w-4 h-4" />}
            {isPlaying ? 'Running...' : 'Run Automation'}
          </button>
        </div>
      </div>
    </div>
  );
}
