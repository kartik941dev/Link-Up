import { useState, useCallback, useEffect, useRef } from 'react';
import { Tag } from '../types/card.js';
import { api, getErrorMessage } from '../utils/api.js';
import { useWorkspace } from '../context/WorkspaceContext.js';

export const useTags = () => {
  const { activePath, dataVersion } = useWorkspace();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const syncedVersionRef = useRef<number>(dataVersion);

  const fetchTags = useCallback(async () => {
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

  useEffect(() => {
    if (activePath === '/' && dataVersion !== syncedVersionRef.current) {
      syncedVersionRef.current = dataVersion;
      fetchTags();
    }
  }, [activePath, dataVersion, fetchTags]);

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
