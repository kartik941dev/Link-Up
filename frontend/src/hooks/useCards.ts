import { useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardFilterOptions } from '../types/card.js';
import { api, getErrorMessage } from '../utils/api.js';
import { useWorkspace } from '../context/WorkspaceContext.js';

export interface CardTypeCounts {
  all: number;
  note: number;
  pdf: number;
  docx: number;
  link: number;
}

export interface BatchIngestResult {
  message: string;
  cards: Card[];
  errors?: Array<{ filename: string; error: string; code?: string }>;
  skipped?: Array<{ filename: string; reason: string; code?: string }>;
  summary?: {
    total?: number;
    totalEntries?: number;
    ingested: number;
    failed?: number;
    skipped?: number;
    archiveName?: string;
  };
}

export const useCards = (initialFilters?: CardFilterOptions) => {
  const { activePath, dataVersion, notifyDataChanged } = useWorkspace();
  const [cards, setCards] = useState<Card[]>([]);
  const [counts, setCounts] = useState<CardTypeCounts>({ all: 0, note: 0, pdf: 0, docx: 0, link: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CardFilterOptions>(initialFilters || {});
  const hasLoadedOnceRef = useRef<boolean>(false);
  const syncedVersionRef = useRef<number>(dataVersion);

  const fetchCards = useCallback(
    async (silent: boolean = false) => {
      if (!silent && !hasLoadedOnceRef.current) {
        setLoading(true);
      }
      setError(null);
      try {
        const params: Record<string, string> = {};
        if (filters.tag) params.tag = filters.tag;
        if (filters.contentType && filters.contentType !== 'all') {
          params.contentType = filters.contentType;
        }
        if (filters.search) params.search = filters.search;

        const res = await api.get<{ cards: Card[]; counts?: CardTypeCounts }>('/cards', { params });
        setCards(res.data.cards);
        if (res.data.counts) {
          setCounts(res.data.counts);
        }
        hasLoadedOnceRef.current = true;
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    fetchCards(hasLoadedOnceRef.current);
  }, [fetchCards]);

  // Silently sync if cards were modified/deleted on another tab (e.g. Smart Arrange or Graph)
  useEffect(() => {
    if (activePath === '/' && dataVersion !== syncedVersionRef.current) {
      syncedVersionRef.current = dataVersion;
      fetchCards(true);
    }
  }, [activePath, dataVersion, fetchCards]);

  const syncAfterMutation = async () => {
    await fetchCards(true);
    syncedVersionRef.current = dataVersion + 1;
    notifyDataChanged();
  };

  // Create Note
  const createNote = async (title: string, content: string, tags: string[]) => {
    try {
      const res = await api.post<{ card: Card }>('/cards', { title, content, tags });
      await syncAfterMutation();
      return res.data.card;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  // Ingest Single PDF
  const ingestPdf = async (file: File, title?: string, tags: string[] = []) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (title && title.trim()) formData.append('title', title.trim());
      formData.append('tags', JSON.stringify(tags));

      const res = await api.post<{ card: Card }>('/cards/ingest/pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      await syncAfterMutation();
      return res.data.card;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  // Batch Ingest Multiple PDFs
  const ingestPdfBatch = async (files: File[], tags: string[] = []): Promise<BatchIngestResult> => {
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      formData.append('tags', JSON.stringify(tags));

      const res = await api.post<BatchIngestResult>('/cards/ingest/pdf/batch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      await syncAfterMutation();
      return res.data;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  // Ingest Single DOCX
  const ingestDocx = async (file: File, title?: string, tags: string[] = []) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (title && title.trim()) formData.append('title', title.trim());
      formData.append('tags', JSON.stringify(tags));

      const res = await api.post<{ card: Card }>('/cards/ingest/docx', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      await syncAfterMutation();
      return res.data.card;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  // Batch Ingest Multiple DOCX
  const ingestDocxBatch = async (files: File[], tags: string[] = []): Promise<BatchIngestResult> => {
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      formData.append('tags', JSON.stringify(tags));

      const res = await api.post<BatchIngestResult>('/cards/ingest/docx/batch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      await syncAfterMutation();
      return res.data;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  // Ingest ZIP Archive
  const ingestZip = async (file: File, tags: string[] = []): Promise<BatchIngestResult> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tags', JSON.stringify(tags));

      const res = await api.post<BatchIngestResult>('/cards/ingest/zip', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      await syncAfterMutation();
      return res.data;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  // Ingest URL Link
  const ingestUrl = async (url: string, tags: string[] = []) => {
    try {
      const res = await api.post<{ card: Card }>(
        '/cards/ingest/social-link',
        { url, tags },
        { timeout: 30000 }
      );
      await syncAfterMutation();
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
      await syncAfterMutation();
      return res.data.card;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  // Delete Card
  const deleteCard = async (cardId: string) => {
    try {
      await api.delete(`/cards/${cardId}`);
      await syncAfterMutation();
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  return {
    cards,
    counts,
    loading,
    error,
    filters,
    setFilters,
    fetchCards,
    createNote,
    ingestPdf,
    ingestPdfBatch,
    ingestDocx,
    ingestDocxBatch,
    ingestZip,
    ingestUrl,
    updateCard,
    deleteCard,
  };
};
