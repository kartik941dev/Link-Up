import { useState, useCallback } from 'react';
import { ChatMessage, RAGQueryResult } from '../types/chat.js';
import { api, getErrorMessage } from '../utils/api.js';

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome-msg',
  role: 'assistant',
  content: `Hello! I am your **LinkUp Agentic RAG Assistant**.\n\nI can reason across your notes, documents, and web bookmarks using both **dense vector semantic search** and **knowledge graph topological connections**.\n\nEvery answer is strictly grounded in your knowledge cards with verifiable source citations and automated hallucination checks. How can I help you today?`,
  timestamp: new Date().toISOString(),
  verification: {
    grounded: true,
    confidence: 1.0,
    unsupported_claims: [],
    explanation: 'System initialization message.',
  },
};

export const useChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_WELCOME_MESSAGE]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (text: string, cardIdsFilter?: string[]) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsgId = `user-${Date.now()}`;
      const userMessage: ChatMessage = {
        id: userMsgId,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);
      setError(null);

      try {
        // Format preceding conversation history
        const conversationHistory = messages
          .filter((m) => m.id !== 'welcome-msg')
          .slice(-6)
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));

        const res = await api.post<{ success: boolean; data: RAGQueryResult }>('/rag/query', {
          query: trimmed,
          conversationHistory,
          cardIdsFilter,
        });

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
        setLoading(false);
      }
    },
    [loading, messages]
  );

  const clearChat = useCallback(() => {
    setMessages([INITIAL_WELCOME_MESSAGE]);
    setError(null);
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearChat,
  };
};
