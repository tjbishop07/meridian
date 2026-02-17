import { useEffect } from 'react';
import { useTickerStore } from '../../store/tickerStore';
import { Info, CheckCircle, AlertTriangle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Ticker() {
  const messages = useTickerStore((state) => state.messages);
  const currentIndex = useTickerStore((state) => state.currentIndex);
  const nextMessage = useTickerStore((state) => state.nextMessage);
  const previousMessage = useTickerStore((state) => state.previousMessage);

  // Ensure currentIndex is valid - always show most recent if out of bounds
  const validIndex = Math.max(0, Math.min(currentIndex, messages.length - 1));
  const currentMessage = messages[validIndex];
  const hasMessages = messages.length > 0;

  // Auto-correct index if it's invalid
  useEffect(() => {
    if (hasMessages && validIndex !== currentIndex) {
      console.log('[Ticker] Correcting invalid index:', currentIndex, '→', validIndex);
      // Reset to show newest message if index is invalid
      useTickerStore.setState({ currentIndex: 0 });
    }
  }, [validIndex, currentIndex, hasMessages]);

  // Icon based on type
  const getIcon = () => {
    if (!currentMessage) return null;
    switch (currentMessage.type) {
      case 'info': return <Info className="w-5 h-5 flex-shrink-0 text-base-content" />;
      case 'success': return <CheckCircle className="w-5 h-5 flex-shrink-0 text-base-content" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 flex-shrink-0 text-base-content" />;
      case 'error': return <XCircle className="w-5 h-5 flex-shrink-0 text-base-content" />;
    }
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="glass fixed bottom-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between gap-4 bg-gradient-to-t from-base-300 via-base-300 to-base-300/95 shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
      {/* Message Content */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {hasMessages ? (
          <>
            {getIcon()}
            <span className="hidden sm:inline badge badge-ghost badge-sm flex-shrink-0 font-mono">
              {formatTime(currentMessage.timestamp)}
            </span>
            <p className="text-base text-base-content font-medium truncate">
              {currentMessage.content}
            </p>
          </>
        ) : (
          <p className="text-base text-base-content/60 font-medium">Ready</p>
        )}
      </div>

      {/* Controls */}
      {messages.length > 1 && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            className="btn btn-ghost btn-sm btn-circle text-base-content/70 hover:bg-base-content/10"
            onClick={previousMessage}
            disabled={validIndex === 0}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-base-content/60 tabular-nums font-medium">
            {validIndex + 1}/{messages.length}
          </span>
          <button
            className="btn btn-ghost btn-sm btn-circle text-base-content/70 hover:bg-base-content/10"
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
