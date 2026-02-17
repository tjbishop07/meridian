import { create } from 'zustand';
import type { TickerMessage, TickerState } from '../types/ticker';

export const useTickerStore = create<TickerState>((set, get) => ({
  messages: [],
  currentIndex: 0,

  addMessage: (message) => {
    const newMessage: TickerMessage = {
      ...message,
      id: `ticker-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };
    set((state) => ({
      messages: [newMessage, ...state.messages], // Prepend new messages (newest first)
      currentIndex: 0 // Always show the newest message
    }));
  },

  removeMessage: (id) => {
    set((state) => {
      const filtered = state.messages.filter((m) => m.id !== id);
      return {
        messages: filtered,
        currentIndex: Math.min(state.currentIndex, filtered.length - 1),
      };
    });
  },

  clearMessages: () => set({ messages: [], currentIndex: 0 }),

  nextMessage: () => {
    const { messages, currentIndex } = get();
    if (currentIndex < messages.length - 1) {
      set({ currentIndex: currentIndex + 1 });
    }
  },

  previousMessage: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
    }
  },
}));
