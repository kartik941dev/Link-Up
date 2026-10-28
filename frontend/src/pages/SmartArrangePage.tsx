import React, { useState } from 'react';
import { Navbar } from '../components/common/Navbar.js';
import { useSmartArrange } from '../hooks/useSmartArrange.js';
import { CardItem } from '../components/cards/CardItem.js';
import { CardDetailModal } from '../components/modals/CardDetailModal.js';
import { EditCardModal } from '../components/modals/EditCardModal.js';
import { Card } from '../types/card.js';
import { api, getErrorMessage } from '../utils/api.js';
import {
  LayoutGrid,
  Sparkles,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Tag as TagIcon,
  Layers,
  FolderKanban,
  Rows,
  SlidersHorizontal,
  Info,
} from 'lucide-react';

export const SmartArrangePage: React.FC = () => {
  const {
    data,
    loading,
    regenerating,
    error,
    selectedClusterId,
    setSelectedClusterId,
    searchFilter,
    setSearchFilter,
    regenerate,
    handleCardDeleted,
    handleCardUpdated,
  } = useSmartArrange();

  // View state: 'swimlanes' (horizontal scroll) or 'grid' (wrap)
  const [viewMode, setViewMode] = useState<'swimlanes' | 'grid'>('swimlanes');
  const [collapsedClusters, setCollapsedClusters] = useState<Record<string, boolean>>({});

  // Modals state
  const [selectedCardForDetail, setSelectedCardForDetail] = useState<Card | null>(null);
  const [cardToEdit, setCardToEdit] = useState<Card | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const toggleCollapse = (clusterId: string) => {
    setCollapsedClusters((prev) => ({
      ...prev,
      [clusterId]: !prev[clusterId],
    }));
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      await api.delete(`/cards/${cardId}`);
      handleCardDeleted(cardId);
      if (selectedCardForDetail?.id === cardId) {
        setSelectedCardForDetail(null);
      }
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  const handleUpdateCard = async (
    cardId: string,
    updates: { title?: string; content?: string; tags?: string[] }
  ) => {
    try {
      const res = await api.put<{ card: Card }>(`/cards/${cardId}`, updates);
      handleCardUpdated(res.data.card);
      if (selectedCardForDetail?.id === cardId) {
        setSelectedCardForDetail(res.data.card);
      }
      setCardToEdit(null);
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
  };

  // Filter clusters by selectedClusterId and searchFilter
  const filteredClusters = (data?.clusters || [])
    .filter((cluster) => {
      if (selectedClusterId && cluster.id !== selectedClusterId) {
        return false;
      }
      return true;
    })
    .map((cluster) => {
      if (!searchFilter.trim()) return cluster;
      const q = searchFilter.toLowerCase();
      const matchingCards = cluster.cards.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.snippet?.toLowerCase().includes(q) ||
          c.tags?.some((t) => t.name.toLowerCase().includes(q))
      );
      return {
        ...cluster,
        card_count: matchingCards.length,
        cards: matchingCards,
      };
    })
    .filter((cluster) => cluster.cards.length > 0);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '2rem', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
        {/* Header Hero */}
        <div
          className="glass-panel"
          style={{
            padding: '2rem 2.5rem',
            marginBottom: '2rem',
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1.5rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div
                  className="brand-icon"
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: 'var(--radius-md)',
                    background: 'linear-gradient(135deg, #6366f1 0%, #38bdf8 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                  }}
                >
                  <LayoutGrid size={22} />
                </div>
                <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
                  Smart Arrange & Semantic Clustering
                </h1>
                <span className="badge badge-indigo" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Sparkles size={12} /> Groq Llama 3.1 & Louvain Modularity
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0, maxWidth: '780px' }}>
                Automated graph community detection clusters interconnected knowledge cards into cohesive thematic groups,
                summarized with AI-generated human topic titles.
              </p>
            </div>

            {/* Quick Stats & Primary Action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {data && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.5rem',
                    padding: '0.75rem 1.25rem',
                    borderRadius: 'var(--radius-lg)',
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-primary)' }}>
                      {data.clustersCount}
                    </div>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
                      Clusters
                    </div>
                  </div>
                  <div style={{ width: '1px', height: '28px', background: 'var(--border-subtle)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--accent-secondary)' }}>
                      {data.totalCards}
                    </div>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
                      Cards Clustered
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={regenerate}
                disabled={regenerating || loading}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.35rem',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
                }}
              >
                <RefreshCw size={16} className={regenerating ? 'spin' : ''} />
                <span>{regenerating ? 'Arranging Knowledge...' : 'Regenerate Arrangement'}</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              marginTop: '1.75rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            {/* Cluster Selector Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginRight: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <SlidersHorizontal size={13} /> Filter:
              </span>
              <button
                onClick={() => setSelectedClusterId(null)}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid',
                  transition: 'all 0.2s ease',
                  background: selectedClusterId === null ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.04)',
                  borderColor: selectedClusterId === null ? 'var(--accent-primary)' : 'var(--border-subtle)',
                  color: selectedClusterId === null ? '#ffffff' : 'var(--text-muted)',
                }}
              >
                All Themes ({data?.clustersCount || 0})
              </button>

              {data?.clusters.map((c) => {
                const isSelected = selectedClusterId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedClusterId(isSelected ? null : c.id)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid',
                      transition: 'all 0.2s ease',
                      background: isSelected ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)',
                      color: isSelected ? '#ffffff' : 'var(--text-muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <span>{c.name}</span>
                    <span
                      style={{
                        padding: '0.1rem 0.35rem',
                        borderRadius: 'var(--radius-full)',
                        background: isSelected ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.1)',
                        fontSize: '0.68rem',
                      }}
                    >
                      {c.card_count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search within clusters & View Mode switch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.35rem 0.75rem',
                  gap: '0.5rem',
                  width: '240px',
                }}
              >
                <Search size={14} style={{ color: 'var(--text-dim)' }} />
                <input
                  type="text"
                  placeholder="Filter cards in clusters..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-main)',
                    fontSize: '0.82rem',
                    width: '100%',
                  }}
                />
              </div>

              {/* View Mode Toggle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(15, 23, 42, 0.6)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  padding: '2px',
                }}
              >
                <button
                  onClick={() => setViewMode('swimlanes')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.35rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: viewMode === 'swimlanes' ? 'var(--accent-primary)' : 'transparent',
                    color: viewMode === 'swimlanes' ? '#ffffff' : 'var(--text-dim)',
                    transition: 'all 0.2s ease',
                  }}
                  title="Horizontal Swimlanes"
                >
                  <Rows size={14} />
                  <span>Swimlanes</span>
                </button>

                <button
                  onClick={() => setViewMode('grid')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.35rem 0.65rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: viewMode === 'grid' ? 'var(--accent-primary)' : 'transparent',
                    color: viewMode === 'grid' ? '#ffffff' : 'var(--text-dim)',
                    transition: 'all 0.2s ease',
                  }}
                  title="Grid Flow"
                >
                  <LayoutGrid size={14} />
                  <span>Grid</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error notification */}
        {(error || actionError) && (
          <div
            className="glass-panel"
            style={{
              padding: '1rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--accent-rose)',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              fontSize: '0.88rem',
            }}
          >
            <Info size={16} />
            <span>{error || actionError}</span>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="glass-panel"
                style={{
                  padding: '1.75rem',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ width: '180px', height: '24px', background: 'rgba(255, 255, 255, 0.07)', borderRadius: '4px' }} className="pulse" />
                  <div style={{ width: '80px', height: '18px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: '12px' }} className="pulse" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
                  {[1, 2, 3].map((cardN) => (
                    <div
                      key={cardN}
                      style={{
                        height: '190px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                      }}
                      className="pulse"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && (!data || data.totalCards === 0) && (
          <div
            className="glass-panel"
            style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <div
              className="brand-icon"
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 1.5rem',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--accent-primary)',
              }}
            >
              <FolderKanban size={32} />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              No Knowledge Cards Found
            </h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto 1.75rem', fontSize: '0.95rem' }}>
              Create or ingest your notes, documents, and web links from the main Canvas page. Once ingested, Smart Arrange will automatically partition them into semantic clusters.
            </p>
            <a href="/" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Go to Canvas & Ingest Cards
            </a>
          </div>
        )}

        {/* Clustered Swimlanes / Sections */}
        {!loading && filteredClusters.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {filteredClusters.map((cluster) => {
              const isCollapsed = collapsedClusters[cluster.id] || false;

              return (
                <section
                  key={cluster.id}
                  className="glass-panel"
                  style={{
                    borderRadius: 'var(--radius-xl)',
                    padding: '1.75rem 2rem',
                    border: '1px solid var(--border-subtle)',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {/* Cluster Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      paddingBottom: isCollapsed ? '0' : '1.25rem',
                      borderBottom: isCollapsed ? 'none' : '1px solid var(--border-subtle)',
                    }}
                    onClick={() => toggleCollapse(cluster.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: 'var(--radius-md)',
                          background: 'rgba(99, 102, 241, 0.18)',
                          color: 'var(--accent-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Layers size={18} />
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <h2
                            style={{
                              fontSize: '1.25rem',
                              fontWeight: 700,
                              color: 'var(--text-main)',
                              margin: 0,
                            }}
                          >
                            {cluster.name}
                          </h2>

                          <span
                            style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: 'var(--radius-full)',
                              background: 'rgba(99, 102, 241, 0.12)',
                              border: '1px solid rgba(99, 102, 241, 0.3)',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: 'var(--accent-primary)',
                            }}
                          >
                            {cluster.card_count} {cluster.card_count === 1 ? 'card' : 'cards'}
                          </span>

                          <span
                            className="badge badge-indigo"
                            style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}
                          >
                            <Sparkles size={10} style={{ marginRight: '0.25rem' }} /> AI Theme
                          </span>
                        </div>

                        {/* Common Tags Subheader */}
                        {cluster.common_tags && cluster.common_tags.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.35rem' }}>
                            <TagIcon size={11} style={{ color: 'var(--text-dim)' }} />
                            {cluster.common_tags.map((tag) => (
                              <span
                                key={tag}
                                style={{
                                  fontSize: '0.72rem',
                                  color: 'var(--text-dim)',
                                  background: 'rgba(255, 255, 255, 0.03)',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: 'var(--radius-sm)',
                                }}
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Collapse Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCollapse(cluster.id);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '0.4rem',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title={isCollapsed ? 'Expand cluster' : 'Collapse cluster'}
                    >
                      {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                    </button>
                  </div>

                  {/* Cluster Cards Container */}
                  {!isCollapsed && (
                    <div style={{ marginTop: '1.5rem' }}>
                      {viewMode === 'swimlanes' ? (
                        /* Horizontal Swimlane Scroll */
                        <div
                          style={{
                            display: 'flex',
                            gap: '1.25rem',
                            overflowX: 'auto',
                            paddingBottom: '0.75rem',
                            scrollSnapType: 'x mandatory',
                          }}
                        >
                          {cluster.cards.map((card) => (
                            <div
                              key={card.id}
                              style={{
                                minWidth: '320px',
                                maxWidth: '360px',
                                flex: '0 0 auto',
                                scrollSnapAlign: 'start',
                              }}
                            >
                              <CardItem
                                card={card}
                                onViewDetail={(c) => setSelectedCardForDetail(c)}
                                onEdit={(c) => setCardToEdit(c)}
                                onDelete={handleDeleteCard}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        /* Grid Layout */
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                            gap: '1.25rem',
                          }}
                        >
                          {cluster.cards.map((card) => (
                            <CardItem
                              key={card.id}
                              card={card}
                              onViewDetail={(c) => setSelectedCardForDetail(c)}
                              onEdit={(c) => setCardToEdit(c)}
                              onDelete={handleDeleteCard}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* Filtered empty state */}
        {!loading && data && data.totalCards > 0 && filteredClusters.length === 0 && (
          <div
            className="glass-panel"
            style={{
              padding: '3rem 2rem',
              textAlign: 'center',
              borderRadius: 'var(--radius-xl)',
            }}
          >
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', margin: '0 0 1rem' }}>
              No cards matched "{searchFilter}" in the selected cluster view.
            </p>
            <button
              onClick={() => {
                setSearchFilter('');
                setSelectedClusterId(null);
              }}
              className="btn btn-secondary"
            >
              Clear Filters
            </button>
          </div>
        )}
      </main>

      {/* Card Detail Modal */}
      <CardDetailModal
        card={selectedCardForDetail}
        isOpen={selectedCardForDetail !== null}
        onClose={() => setSelectedCardForDetail(null)}
        onEdit={(card) => {
          setSelectedCardForDetail(null);
          setCardToEdit(card);
        }}
        onDelete={async (cardId) => {
          await handleDeleteCard(cardId);
          setSelectedCardForDetail(null);
        }}
      />

      {/* Edit Card Modal */}
      <EditCardModal
        card={cardToEdit}
        isOpen={cardToEdit !== null}
        onClose={() => setCardToEdit(null)}
        onSubmit={handleUpdateCard}
      />
    </div>
  );
};
