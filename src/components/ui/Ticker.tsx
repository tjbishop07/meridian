import { useEffect } from 'react';
import { useTickerStore } from '../../store/tickerStore';
import { Info, CheckCircle, AlertTriangle, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Ticker() {
  const messages = useTickerStore((state) => state.messages);
  const currentIndex = useTickerStore((state) => state.currentIndex);
  const removeMessage = useTickerStore((state) => state.removeMessage);
  const nextMessage = useTickerStore((state) => state.nextMessage);
  const previousMessage = useTickerStore((state) => state.previousMessage);

  const currentMessage = messages[currentIndex];
  const hasMessages = messages.length > 0;

  // Auto-dismiss timer
  useEffect(() => {
    if (!currentMessage || !currentMessage.duration) return;

    const timer = setTimeout(() => {
      removeMessage(currentMessage.id);
    }, currentMessage.duration);

    return () => clearTimeout(timer);
  }, [currentMessage, removeMessage]);

  // Icon based on type
  const getIcon = () => {
    if (!currentMessage) return null;
    const iconClass = "w-6 h-6 flex-shrink-0 text-info-content";
    switch (currentMessage.type) {
      case 'info': return <Info className={iconClass} />;
      case 'success': return <CheckCircle className={iconClass} />;
      case 'warning': return <AlertTriangle className={iconClass} />;
      case 'error': return <XCircle className={iconClass} />;
    }
  };

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="bg-info px-6 py-4 flex items-center justify-between gap-4 shadow-[0_-4px_16px_rgba(0,0,0,0.2)]">
      {/* Message Content */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {hasMessages ? (
          <>
            {getIcon()}
            <p className="text-base text-info-content font-medium truncate">
              {currentMessage.content}
            </p>
            <span className="hidden sm:inline text-sm text-info-content/70 flex-shrink-0">
              {formatTime(currentMessage.timestamp)}
            </span>
          </>
        ) : (
          <p className="text-base text-info-content/70 font-medium">Ready</p>
        )}
      </div>

      {/* Controls */}
      {messages.length > 1 && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            className="btn btn-ghost btn-sm btn-circle text-info-content hover:bg-info-content/10"
            onClick={previousMessage}
            disabled={currentIndex === 0}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-info-content/70 tabular-nums font-medium">
            {currentIndex + 1}/{messages.length}
          </span>
          <button
            className="btn btn-ghost btn-sm btn-circle text-info-content hover:bg-info-content/10"
            onClick={nextMessage}
            disabled={currentIndex === messages.length - 1}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
