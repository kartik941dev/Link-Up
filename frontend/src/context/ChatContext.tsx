import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ChatMessage, RAGQueryResult } from '../types/chat.js';
import { api, getErrorMessage } from '../utils/api.js';
import { useAuth } from './AuthContext.js';

const CHAT_STORAGE_PREFIX = 'linkup_chat_history_';
const MAX_STORED_MESSAGES = 60;

const createWelcomeMessage = (): ChatMessage => ({
  id: 'welcome-msg',
  role: 'assistant',
  content: `Hello! I am your **LinkUp Agentic RAG Assistant**.\n\nI can reason across your notes, documents, and web bookmarks using both **dense vector semantic search** and **knowledge graph topological connections**.\n\nEvery answer is strictly grounded in your knowledge cards with verifiable source citations and automated hallucination checks. How can I help you today?`,
  timestamp: new Date().toISOString(),
});

const getStorageKey = (userId?: string | null): string | null =>
  userId ? `${CHAT_STORAGE_PREFIX}${userId}` : null;

const loadMessagesForUser = (userId?: string | null): ChatMessage[] => {
  const key = getStorageKey(userId);
  if (!key) return [createWelcomeMessage()];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [createWelcomeMessage()];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('[CHAT] Failed to load persisted chat history:', err);
  }
  return [createWelcomeMessage()];
};

interface ChatContextType {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  sendMessage: (text: string, cardIdsFilter?: string[]) => Promise<void>;
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const activeUserIdRef = useRef<string | null>(userId);

  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessagesForUser(userId));
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync chat state whenever the signed-in user changes (isolates chat per account)
  useEffect(() => {
    activeUserIdRef.current = userId;
    setMessages(loadMessagesForUser(userId));
    setLoading(false);
    setError(null);
  }, [userId]);

  // Persist messages for the active user so navigation & page reloads retain chat history
  useEffect(() => {
    const key = getStorageKey(userId);
    if (!key) return;
    try {
      const toSave = messages.slice(-MAX_STORED_MESSAGES);
      localStorage.setItem(key, JSON.stringify(toSave));
    } catch (err) {
      console.warn('[CHAT] Could not save chat history to localStorage:', err);
    }
  }, [messages, userId]);

  const sendMessage = useCallback(
    async (text: string, cardIdsFilter?: string[]) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const requestUserId = activeUserIdRef.current;
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      const historySnapshot = messages
        .filter((m) => m.id !== 'welcome-msg')
        .slice(-6)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);
      setError(null);

      try {
        const res = await api.post<{ success: boolean; data: RAGQueryResult }>(
          '/rag/query',
          {
            query: trimmed,
            conversationHistory: historySnapshot,
            cardIdsFilter,
          },
          { timeout: 60000 }
        );

        // Ignore response if the user signed out or switched accounts mid-request
        if (activeUserIdRef.current !== requestUserId) return;

        if (res.data.success && res.data.data) {
          const result = res.data.data;
          const assistantMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: result.answer,
            citations: result.citations,
            verification: result.verification,
            timestamp: new Date().toISOString(),
            retrievedCardsCount: result.retrievedCardsCount,
            graphExpansionUsed: result.graphExpansionUsed,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }
      } catch (err) {
        if (activeUserIdRef.current !== requestUserId) return;

        const errorMsg = getErrorMessage(err);
        setError(errorMsg);
        const errorAssistantMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Error generating response:** ${errorMsg}\n\nPlease verify that your backend and ML services are running, or try rephrasing your question.`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorAssistantMsg]);
      } finally {
        if (activeUserIdRef.current === requestUserId) {
          setLoading(false);
        }
      }
    },
    [loading, messages]
  );

  const clearChat = useCallback(() => {
    const key = getStorageKey(activeUserIdRef.current);
    if (key) {
      localStorage.removeItem(key);
    }
    setMessages([createWelcomeMessage()]);
    setError(null);
  }, []);

  return (
    <ChatContext.Provider value={{ messages, loading, error, sendMessage, clearChat }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChatContext = (): ChatContextType => {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return ctx;
};
