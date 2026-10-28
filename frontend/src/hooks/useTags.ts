import { useState, useCallback, useEffect } from 'react';
import { Tag } from '../types/card.js';
import { api, getErrorMessage } from '../utils/api.js';

export const useTags = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ tags: Tag[] }>('/tags');
      setTags(res.data.tags);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const createTag = async (name: string) => {
    try {
      const res = await api.post<{ tag: Tag }>('/tags', { name });
      setTags((prev) => {
        if (prev.some((t) => t.id === res.data.tag.id)) return prev;
        return [...prev, { ...res.data.tag, card_count: 0 }];
      });
      return res.data.tag;
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  const deleteTag = async (id: string) => {
    try {
      await api.delete(`/tags/${id}`);
      setTags((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  return { tags, loading, error, fetchTags, createTag, deleteTag };
};
