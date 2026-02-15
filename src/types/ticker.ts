export interface TickerMessage {
  id: string;
  content: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
  duration?: number; // Auto-dismiss in ms, 0 = persistent
}

export interface TickerState {
  messages: TickerMessage[];
  currentIndex: number;
  addMessage: (message: Omit<TickerMessage, 'id' | 'timestamp'>) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;
  nextMessage: () => void;
  previousMessage: () => void;
}
