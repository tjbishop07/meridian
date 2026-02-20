import { useEffect } from 'react';
import { useTickerStore } from '../../store/tickerStore';
import { Info, CheckCircle, AlertTriangle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Ticker() {
  const messages = useTickerStore((state) => state.messages);
  const currentIndex = useTickerStore((state) => state.currentIndex);
  const nextMessage = useTickerStore((state) => state.nextMessage);
  const previousMessage = useTickerStore((state) => state.previousMessage);

  const validIndex = Math.max(0, Math.min(currentIndex, messages.length - 1));
  const currentMessage = messages[validIndex];
  const hasMessages = messages.length > 0;

  useEffect(() => {
    if (hasMessages && validIndex !== currentIndex) {
      console.log('[Ticker] Correcting invalid index:', currentIndex, '→', validIndex);
      useTickerStore.setState({ currentIndex: 0 });
    }
  }, [validIndex, currentIndex, hasMessages]);

  const getIcon = () => {
    if (!currentMessage) return null;
    switch (currentMessage.type) {
      case 'info': return <Info className="w-5 h-5 flex-shrink-0 text-foreground" />;
      case 'success': return <CheckCircle className="w-5 h-5 flex-shrink-0 text-foreground" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 flex-shrink-0 text-foreground" />;
      case 'error': return <XCircle className="w-5 h-5 flex-shrink-0 text-foreground" />;
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between gap-4 bg-gradient-to-t from-muted via-muted to-muted/95 border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
      {/* Message Content */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {hasMessages ? (
          <>
            {getIcon()}
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted-foreground/10 text-muted-foreground font-mono flex-shrink-0">
              {formatTime(currentMessage.timestamp)}
            </span>
            <p className="text-base text-primary font-medium truncate">
              {currentMessage.content}
            </p>
          </>
        ) : (
          <p className="text-base text-muted-foreground font-medium">Ready</p>
        )}
      </div>

      {/* Controls */}
      {messages.length > 1 && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            className="p-1.5 rounded-full text-muted-foreground hover:bg-muted-foreground/10 transition-colors disabled:opacity-30"
            onClick={previousMessage}
            disabled={validIndex === 0}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-muted-foreground tabular-nums font-medium">
            {validIndex + 1}/{messages.length}
          </span>
          <button
            className="p-1.5 rounded-full text-muted-foreground hover:bg-muted-foreground/10 transition-colors disabled:opacity-30"
            onClick={nextMessage}
            disabled={validIndex === messages.length - 1}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
