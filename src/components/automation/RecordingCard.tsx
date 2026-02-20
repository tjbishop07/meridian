import { Play, Pencil, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
    let date: Date;

    if (dateStr.includes('T') || dateStr.includes('Z')) {
      date = new Date(dateStr);
    } else {
      date = new Date(dateStr + ' UTC');
    }

    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

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

  const progressPct = progress
    ? Math.min(100, Math.round((progress.currentStep / (progress.totalSteps || 1)) * 100))
    : 0;

  return (
    <tr className={cn('group transition-all', isPlaying ? 'bg-primary/5' : 'hover:bg-muted/30')}>
      {/* Name */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <img
            src={getFaviconUrl(recording.url)}
            className="w-4 h-4"
            alt=""
            onError={(e) => {
              e.currentTarget.src = 'https://www.google.com/s2/favicons?domain=example.com&sz=32';
            }}
          />
          <span className="font-medium text-foreground">{recording.name}</span>
          {recording.institution && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary/10 text-primary font-medium">
              {recording.institution}
            </span>
          )}
        </div>
      </td>

      {/* Account */}
      <td className="px-4 py-3">
        {recording.account_name ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-success/10 text-success font-medium">
            {recording.account_name}
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
            No account
          </span>
        )}
      </td>

      {/* Steps */}
      <td className="px-4 py-3 text-sm text-muted-foreground text-center">
        {recording.steps.length}
      </td>

      {/* Last Run */}
      <td className="px-4 py-3 text-sm">
        {recording.last_run_at ? (
          <span className="text-success">{formatLastRunTime(recording.last_run_at)}</span>
        ) : (
          <span className="text-warning">Never run</span>
        )}
      </td>

      {/* Status/Progress */}
      <td className="px-4 py-3">
        {isPlaying ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium" style={{ color: progress?.color || '#3b82f6' }}>
                {progress?.status || 'Starting...'}
              </span>
              <span className="text-muted-foreground">
                {progress?.currentStep || 0}/{progress?.totalSteps || recording.steps.length}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1">
              <div
                className="h-1 rounded-full bg-primary transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Ready</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-2 py-3">
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            onClick={() => onPlay(recording.id)}
            disabled={isPlaying}
          >
            {!isPlaying && <Play className="w-4 h-4 mr-1" />}
            {isPlaying ? 'Running...' : 'Run'}
          </Button>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => onEdit(recording)}
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            <button
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => onDuplicate(recording.id)}
              title="Duplicate"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            <button
              className="p-1 text-muted-foreground hover:text-destructive transition-colors"
              onClick={() => onDelete(recording.id)}
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}
