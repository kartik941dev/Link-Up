import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from '../components/common/Navbar.js';
import { KnowledgeGraphView } from '../components/graph/KnowledgeGraphView.js';
import { CardDetailModal } from '../components/modals/CardDetailModal.js';
import { useWorkspace } from '../context/WorkspaceContext.js';
import { api, getErrorMessage } from '../utils/api.js';
import { GraphData } from '../types/graph.js';
import { Card } from '../types/card.js';
import { Network, AlertCircle, RefreshCw, UploadCloud, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';

export const GraphPage: React.FC = () => {
  const { activePath, dataVersion, notifyDataChanged } = useWorkspace();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [minSimilarity, setMinSimilarity] = useState<number>(0.45);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [selectedFullCard, setSelectedFullCard] = useState<Card | null>(null);
  const syncedVersionRef = useRef<number>(dataVersion);

  const handleOpenCardDetail = async (cardId: string) => {
    try {
      const res = await api.get<{ card: Card }>(`/cards/${cardId}`);
      if (res.data.card) {
        setSelectedFullCard(res.data.card);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  // Fetch Graph (silent mode keeps existing graph visible without flashing loader)
  const fetchGraph = useCallback(
    async (threshold: number = minSimilarity, silent: boolean = false) => {
      try {
        if (!silent) setLoading(true);
        setError(null);
        const res = await api.get<{ success: boolean; data: GraphData }>(
          `/graph?minSimilarity=${threshold}`
        );
        if (res.data.success) {
          setGraphData(res.data.data);
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [minSimilarity]
  );

  const handleDeleteCard = async (cardId: string) => {
    try {
      await api.delete(`/cards/${cardId}`);
      setSelectedFullCard(null);
      notifyDataChanged();
      await fetchGraph(minSimilarity, true);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  useEffect(() => {
    fetchGraph(minSimilarity, graphData !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minSimilarity]);

  // Silently sync graph when cards changed on another tab (e.g. uploaded/deleted on Canvas)
  useEffect(() => {
    if (activePath === '/graph' && dataVersion !== syncedVersionRef.current) {
      syncedVersionRef.current = dataVersion;
      fetchGraph(minSimilarity, true);
    }
  }, [activePath, dataVersion, minSimilarity, fetchGraph]);

  // Handle Rebuild Request
  const handleRebuild = async () => {
    try {
      setError(null);
      setFeedbackMsg('Recalculating pairwise similarities & PageRank centralities...');
      const res = await api.post('/graph/rebuild', { minSimilarity });
      if (res.data.success) {
        setFeedbackMsg('Knowledge graph updated successfully!');
        await fetchGraph(minSimilarity, true);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  // Handle Data Export (JSON / CSV)
  const handleExport = async (format: 'json' | 'csv' | 'png' | 'svg') => {
    if (format === 'json') {
      try {
        const res = await api.get('/graph/export?format=json');
        const blob = new Blob([JSON.stringify(res.data, null, 2)], {
          type: 'application/json',
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `linkup-knowledge-graph-${Date.now()}.json`;
        link.click();
      } catch (err) {
        setError(getErrorMessage(err));
      }
    } else if (format === 'csv') {
      try {
        const res = await api.get('/graph/export?format=csv', { responseType: 'blob' });
        const blob = new Blob([res.data], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `linkup-knowledge-graph-${Date.now()}.csv`;
        link.click();
      } catch (err) {
        setError(getErrorMessage(err));
      }
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '1.5rem 2rem', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
        {/* Notification Toast */}
        {feedbackMsg && (
          <div
            className="glass-panel"
            style={{
              padding: '0.75rem 1.25rem',
              marginBottom: '1rem',
              borderColor: 'rgba(99, 102, 241, 0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              fontSize: '0.875rem',
              color: '#38bdf8',
            }}
          >
            <RefreshCw size={16} className="spin-slow" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div
            className="glass-panel"
            style={{
              padding: '0.75rem 1.25rem',
              marginBottom: '1rem',
              borderColor: 'rgba(244, 63, 94, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              fontSize: '0.875rem',
              color: '#fb7185',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && !graphData && (
          <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div className="brand-icon" style={{ width: '48px', height: '48px', margin: '0 auto 1.25rem' }}>
              <Network size={24} className="spin-slow" />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Synthesizing Knowledge Network...
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Querying card embeddings and resolving semantic relationships.
            </p>
          </div>
        )}

        {/* Empty State */}
        {!loading && graphData && graphData.nodes.length === 0 && (
          <div className="glass-panel" style={{ padding: '4rem 2rem', textAlign: 'center', maxWidth: '640px', margin: '3rem auto' }}>
            <div className="brand-icon" style={{ width: '56px', height: '56px', margin: '0 auto 1.5rem', borderRadius: 'var(--radius-lg)' }}>
              <Layers size={28} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>
              Your Knowledge Canvas is Empty
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.75rem', lineHeight: 1.6 }}>
              Upload your PDF documents, DOCX notes, bookmarks, or write quick notes on the canvas. LinkUp will automatically vectorize them and weave your semantic knowledge graph.
            </p>
            <Link to="/" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
              <UploadCloud size={18} style={{ marginRight: '0.4rem' }} /> Go to Canvas to Upload Data
            </Link>
          </div>
        )}

        {/* Interactive Force Graph View */}
        {graphData && graphData.nodes.length > 0 && (
          <KnowledgeGraphView
            nodes={graphData.nodes}
            links={graphData.links}
            stats={graphData.stats}
            loading={loading}
            onRebuild={handleRebuild}
            minSimilarity={minSimilarity}
            onMinSimilarityChange={setMinSimilarity}
            onExport={handleExport}
            onOpenCard={handleOpenCardDetail}
          />
        )}
      </main>

      <CardDetailModal
        card={selectedFullCard}
        isOpen={selectedFullCard !== null}
        onClose={() => setSelectedFullCard(null)}
        onEdit={() => {}}
        onDelete={handleDeleteCard}
      />
    </div>
  );
};
