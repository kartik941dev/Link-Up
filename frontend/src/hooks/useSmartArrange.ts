import { useState, useCallback, useEffect } from 'react';
import { SmartArrangeData, Card } from '../types/card.js';
import { api, getErrorMessage } from '../utils/api.js';

export const useSmartArrange = () => {
  const [data, setData] = useState<SmartArrangeData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [regenerating, setRegenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  const fetchArrangement = useCallback(async (force: boolean = false) => {
    if (force) {
      setRegenerating(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await api.get<{ success: boolean; data: SmartArrangeData }>('/arrange/smart', {
        params: { force: force ? 'true' : 'false', minSimilarity: 0.35 },
      });
      if (res.data.success && res.data.data) {
        setData(res.data.data);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }, []);

  useEffect(() => {
    fetchArrangement(false);
  }, [fetchArrangement]);

  const regenerate = () => {
    fetchArrangement(true);
  };

  const handleCardDeleted = (cardId: string) => {
    if (!data) return;
    const updatedClusters = data.clusters
      .map((cluster) => {
        const remainingCards = cluster.cards.filter((c) => c.id !== cardId);
        return {
          ...cluster,
          card_count: remainingCards.length,
          cards: remainingCards,
        };
      })
      .filter((cluster) => cluster.card_count > 0);

    setData({
      ...data,
      totalCards: Math.max(0, data.totalCards - 1),
      clustersCount: updatedClusters.length,
      clusters: updatedClusters,
    });
  };

  const handleCardUpdated = (updatedCard: Card) => {
    if (!data) return;
    const updatedClusters = data.clusters.map((cluster) => ({
      ...cluster,
      cards: cluster.cards.map((c) => (c.id === updatedCard.id ? updatedCard : c)),
    }));
    setData({
      ...data,
      clusters: updatedClusters,
    });
  };

  return {
    data,
    loading,
    regenerating,
    error,
    selectedClusterId,
    setSelectedClusterId,
    searchFilter,
    setSearchFilter,
    regenerate,
    refetch: () => fetchArrangement(false),
    handleCardDeleted,
    handleCardUpdated,
  };
};
