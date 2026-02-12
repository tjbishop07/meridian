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
}

interface RecordingCardProps {
  recording: Recording;
  onPlay: (id: string) => void;
  onEdit: (recording: Recording) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  isPlaying?: boolean;
}

export function RecordingCard({
  recording,
  onPlay,
  onEdit,
  onDelete,
  onDuplicate,
  isPlaying = false
}: RecordingCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
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
        </div>

        <div className="flex gap-4 text-sm text-base-content/70">
          <span>{recording.steps.length} steps</span>
          <span>Updated {formatRelativeTime(recording.updated_at)}</span>
        </div>

        <div className="card-actions justify-end mt-4">
          <button
            className={`btn btn-primary btn-sm ${isPlaying ? 'loading' : ''}`}
            onClick={() => onPlay(recording.id)}
            disabled={isPlaying}
          >
            {!isPlaying && <Play className="w-4 h-4" />}
            {isPlaying ? 'Playing...' : 'Run Automation'}
          </button>
        </div>
      </div>
    </div>
  );
}
