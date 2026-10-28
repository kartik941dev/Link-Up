import { useState, useEffect, useCallback } from 'react';
import { api, getErrorMessage } from '../utils/api.js';
import { SearchMode, SearchResultItem, SearchResponse } from '../types/search.js';

export function useSearch(initialMode: SearchMode = 'hybrid') {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>(initialMode);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeSearch = useCallback(
    async (searchTerm: string, searchMode: SearchMode) => {
      const trimmed = searchTerm.trim();
      if (!trimmed) {
        setResults([]);
        setTotal(0);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const res = await api.get<SearchResponse>('/search', {
          params: {
            q: trimmed,
            mode: searchMode,
            limit: 24,
          },
        });

        setResults(res.data.results || []);
        setTotal(res.data.total || 0);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Debounced search trigger
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      executeSearch(query, mode);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, mode, executeSearch]);

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setTotal(0);
    setError(null);
  };

  return {
    query,
    setQuery,
    mode,
    setMode,
    results,
    total,
    loading,
    error,
    clearSearch,
    isSearching: query.trim().length > 0,
  };
}
