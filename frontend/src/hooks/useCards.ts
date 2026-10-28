import { useState, useCallback, useEffect } from 'react';
import { Card, CardFilterOptions } from '../types/card.js';
import { api, getErrorMessage } from '../utils/api.js';

export const useCards = (initialFilters?: CardFilterOptions) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CardFilterOptions>(initialFilters || {});

  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (filters.tag) params.tag = filters.tag;
      if (filters.contentType && filters.contentType !== 'all') {
        params.contentType = filters.contentType;
      }
      if (filters.search) params.search = filters.search;

      const res = await api.get<{ cards: Card[] }>('/cards', { params });
      setCards(res.data.cards);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Create Note
  const createNote = async (title: string, content: string, tags: string[]) => {
    try {
      const res = await api.post<{ card: Card }>('/cards', { title, content, tags });
      setCards((prev) => [res.data.card, ...prev]);
      return res.data.card;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  // Ingest PDF
  const ingestPdf = async (file: File, title?: string, tags: string[] = []) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (title) formData.append('title', title);
      formData.append('tags', JSON.stringify(tags));

      const res = await api.post<{ card: Card }>('/cards/ingest/pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCards((prev) => [res.data.card, ...prev]);
      return res.data.card;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  // Ingest DOCX
  const ingestDocx = async (file: File, title?: string, tags: string[] = []) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (title) formData.append('title', title);
      formData.append('tags', JSON.stringify(tags));

      const res = await api.post<{ card: Card }>('/cards/ingest/docx', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCards((prev) => [res.data.card, ...prev]);
      return res.data.card;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  // Ingest URL Link
  const ingestUrl = async (url: string, tags: string[] = []) => {
    try {
      const res = await api.post<{ card: Card }>('/cards/ingest/social-link', { url, tags });
      setCards((prev) => [res.data.card, ...prev]);
      return res.data.card;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  // Update Card
  const updateCard = async (
    cardId: string,
    updates: { title?: string; content?: string; tags?: string[] }
  ) => {
    try {
      const res = await api.put<{ card: Card }>(`/cards/${cardId}`, updates);
      setCards((prev) => prev.map((c) => (c.id === cardId ? res.data.card : c)));
      return res.data.card;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  // Delete Card
  const deleteCard = async (cardId: string) => {
    try {
      await api.delete(`/cards/${cardId}`);
      setCards((prev) => prev.filter((c) => c.id !== cardId));
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  return {
    cards,
    loading,
    error,
    filters,
    setFilters,
    fetchCards,
    createNote,
    ingestPdf,
    ingestDocx,
    ingestUrl,
    updateCard,
    deleteCard,
  };
};
