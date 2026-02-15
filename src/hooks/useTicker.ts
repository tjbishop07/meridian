import { useTickerStore } from '../store/tickerStore';

export function useTicker() {
  const addMessage = useTickerStore((state) => state.addMessage);
  const clearMessages = useTickerStore((state) => state.clearMessages);

  return {
    info: (message: string, duration = 4000) => {
      addMessage({ content: message, type: 'info', duration });
    },
    success: (message: string, duration = 3000) => {
      addMessage({ content: message, type: 'success', duration });
    },
    warning: (message: string, duration = 5000) => {
      addMessage({ content: message, type: 'warning', duration });
    },
    error: (message: string, duration = 5000) => {
      addMessage({ content: message, type: 'error', duration });
    },
    persistent: (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
      addMessage({ content: message, type, duration: 0 });
    },
    clear: () => clearMessages(),
  };
}
