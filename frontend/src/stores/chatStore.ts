/**
 * Questboard — Chat store
 * Manages chat messages, whispers, and system messages.
 */

import { create } from "zustand";
import type { ChatMessage } from "@/types";

interface ChatState {
  messages: ChatMessage[];
  unreadCount: number;

  addMessage: (msg: ChatMessage) => void;
  clearUnread: () => void;
  clear: () => void;
}

let nextId = 1;

export function createChatMessage(
  type: ChatMessage["type"],
  from: string,
  content: string,
  target?: string
): ChatMessage {
  return {
    id: String(nextId++),
    type,
    from,
    content,
    target,
    timestamp: Date.now(),
  };
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  unreadCount: 0,

  addMessage: (msg) =>
    set((s) => ({
      messages: [...s.messages, msg],
      unreadCount: s.unreadCount + 1,
    })),

  clearUnread: () => set({ unreadCount: 0 }),

  clear: () => set({ messages: [], unreadCount: 0 }),
}));
