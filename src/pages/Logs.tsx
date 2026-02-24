import { useEffect, useRef, useState } from 'react';
import { PageSidebar } from '@/components/ui/PageSidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type LogLevel = 'debug' | 'info' | 'success' | 'warning' | 'error';
type LogSource = string;

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  message: string;
}

const ALL_LEVELS: LogLevel[] = ['debug', 'info', 'success', 'warning', 'error'];

const LEVEL_STYLES: Record<LogLevel, string> = {
  debug: 'bg-muted/60 text-muted-foreground',
  info: 'bg-blue-500/15 text-blue-400',
  success: 'bg-emerald-500/15 text-emerald-400',
  warning: 'bg-amber-500/15 text-amber-400',
  error: 'bg-red-500/15 text-red-400',
};

const ROW_LEVEL_STYLES: Record<LogLevel, string> = {
  debug: 'text-muted-foreground/70',
  info: 'text-foreground/80',
  success: 'text-emerald-400/90',
  warning: 'text-amber-400/90',
  error: 'text-red-400',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

export default function Logs() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  // Hydrate on mount
  useEffect(() => {
    window.electron.invoke('logs:get-all').then((all: LogEntry[]) => {
      setEntries(all);
    });
  }, []);

  // Listen for new entries
  useEffect(() => {
    const handler = (entry: LogEntry) => {
      setEntries(prev => {
        const next = [...prev, entry];
        return next.length > 500 ? next.slice(next.length - 500) : next;
      });
    };
    window.electron.on('logs:new-entry', handler);
    return () => {
      window.electron.removeListener('logs:new-entry', handler);
    };
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [entries, autoScroll]);

  const uniqueSources = Array.from(new Set(entries.map(e => e.source))).sort();

  const filtered = entries.filter(e => {
    if (levelFilter !== 'all' && e.level !== levelFilter) return false;
    if (sourceFilter !== 'all' && e.source !== sourceFilter) return false;
    return true;
  });

  function handleClear() {
    window.electron.invoke('logs:clear');
    setEntries([]);
  }

  return (
    <div className="flex h-full">
      <PageSidebar title="Logs">
        {/* Level filter */}
        <div className="px-3 py-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Level</p>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setLevelFilter('all')}
              className={cn(
                'text-left text-xs px-2 py-1.5 rounded transition-colors',
                levelFilter === 'all'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground/70 hover:bg-muted hover:text-foreground'
              )}
            >
              All levels
            </button>
            {ALL_LEVELS.map(level => (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                className={cn(
                  'text-left text-xs px-2 py-1.5 rounded transition-colors flex items-center gap-2',
                  levelFilter === level
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                )}
              >
                <span className={cn('inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase leading-none', LEVEL_STYLES[level])}>
                  {level}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Source filter */}
        {uniqueSources.length > 0 && (
          <div className="px-3 py-3 border-t border-border/50">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Source</p>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setSourceFilter('all')}
                className={cn(
                  'text-left text-xs px-2 py-1.5 rounded transition-colors',
                  sourceFilter === 'all'
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                )}
              >
                All sources
              </button>
              {uniqueSources.map(source => (
                <button
                  key={source}
                  onClick={() => setSourceFilter(source)}
                  className={cn(
                    'text-left text-xs px-2 py-1.5 rounded transition-colors',
                    sourceFilter === source
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                  )}
                >
                  {source}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Spacer + Clear */}
        <div className="flex-1" />
        <div className="px-3 py-3 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleClear}
          >
            Clear logs
          </Button>
        </div>
      </PageSidebar>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 shrink-0">
          <span className="text-xs text-muted-foreground font-mono">
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
            {(levelFilter !== 'all' || sourceFilter !== 'all') && (
              <span className="text-muted-foreground/50"> (filtered from {entries.length})</span>
            )}
          </span>
          <button
            onClick={() => setAutoScroll(v => !v)}
            className={cn(
              'text-xs px-2 py-1 rounded transition-colors font-mono',
              autoScroll
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {autoScroll ? 'auto-scroll on' : 'auto-scroll off'}
          </button>
        </div>

        {/* Log list */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto font-mono text-xs leading-5 px-4 py-3 space-y-0.5"
        >
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground/50 text-xs font-mono">no log entries</p>
            </div>
          ) : (
            filtered.map(entry => (
              <div
                key={entry.id}
                className={cn(
                  'flex items-start gap-3 py-0.5 hover:bg-muted/30 rounded px-1 -mx-1 transition-colors',
                  ROW_LEVEL_STYLES[entry.level]
                )}
              >
                <span className="text-muted-foreground/50 shrink-0 tabular-nums">
                  {formatTime(entry.timestamp)}
                </span>
                <span className={cn(
                  'shrink-0 inline-block px-1.5 py-px rounded text-[10px] uppercase leading-none self-center',
                  LEVEL_STYLES[entry.level]
                )}>
                  {entry.level}
                </span>
                <span className="shrink-0 text-muted-foreground/60 min-w-[72px]">
                  {entry.source}
                </span>
                <span className="break-all">{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
