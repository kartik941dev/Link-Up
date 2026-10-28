import React from 'react';
import { SearchResultItem, SearchMode } from '../../types/search.js';
import { Card } from '../../types/card.js';
import {
  Sparkles,
  Brain,
  FileText,
  File,
  Globe,
  StickyNote,
  ExternalLink,
  Edit2,
  Trash2,
  SearchX,
} from 'lucide-react';

interface SearchResultsGridProps {
  results: SearchResultItem[];
  query: string;
  mode: SearchMode;
  onSelectCard: (card: Card) => void;
  onEditCard: (card: Card) => void;
  onDeleteCard: (cardId: string) => void;
  onClear: () => void;
}

export const SearchResultsGrid: React.FC<SearchResultsGridProps> = ({
  results,
  query,
  mode,
  onSelectCard,
  onEditCard,
  onDeleteCard,
  onClear,
}) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <File size={14} style={{ color: 'var(--accent-rose)' }} />;
      case 'docx':
        return <FileText size={14} style={{ color: 'var(--accent-secondary)' }} />;
      case 'link':
        return <Globe size={14} style={{ color: 'var(--accent-emerald)' }} />;
      case 'note':
      default:
        return <StickyNote size={14} style={{ color: 'var(--accent-amber)' }} />;
    }
  };

  const getMatchBadge = (matchType: 'hybrid' | 'semantic' | 'exact') => {
    switch (matchType) {
      case 'semantic':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.2rem 0.55rem',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(56, 189, 248, 0.15)',
              color: 'var(--accent-secondary)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            <Brain size={11} /> Semantic
          </span>
        );
      case 'exact':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.2rem 0.55rem',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--accent-amber)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            <FileText size={11} /> Exact FTS
          </span>
        );
      case 'hybrid':
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.2rem 0.55rem',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(99, 102, 241, 0.18)',
              color: '#818cf8',
              border: '1px solid rgba(99, 102, 241, 0.4)',
            }}
          >
            <Sparkles size={11} /> Hybrid Match
          </span>
        );
    }
  };

  if (results.length === 0) {
    return (
      <div
        className="glass-panel"
        style={{
          padding: '3.5rem 2rem',
          textAlign: 'center',
          borderRadius: 'var(--radius-lg)',
          marginTop: '1rem',
        }}
      >
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            color: 'var(--text-dim)',
          }}
        >
          <SearchX size={26} />
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          No matching knowledge cards found
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto 1.5rem' }}>
          No cards matched &ldquo;<strong style={{ color: 'var(--text-main)' }}>{query}</strong>&rdquo; under{' '}
          <strong>{mode}</strong> mode. Try switching to <em>Semantic Vector</em> mode to find conceptual matches without exact keywords.
        </p>
        <button onClick={onClear} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
          Reset Search & Return to Canvas
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        }}
      >
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Showing <strong>{results.length}</strong> ranked result(s) for &ldquo;
          <strong style={{ color: 'var(--text-main)' }}>{query}</strong>&rdquo;
        </div>
        <button
          onClick={onClear}
          className="btn btn-secondary"
          style={{ padding: '0.35rem 0.75rem', fontSize: '0.775rem' }}
        >
          Clear & Return to All Cards
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {results.map((item) => {
          const matchPercent = Math.min(Math.round(item.similarity_score * 100), 100);

          // Card object adapter for modals
          const cardAdapter: Card = {
            id: item.id,
            user_id: '',
            title: item.title,
            content_type: item.content_type,
            extracted_text: item.snippet,
            snippet: item.snippet,
            tags: item.tags,
            created_at: item.created_at,
            updated_at: item.created_at,
          };

          return (
            <div
              key={item.id}
              className="card-item glass-panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                position: 'relative',
                transition: 'all var(--transition-fast)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                {/* Header: Content Type & Badges */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.75rem',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {getTypeIcon(item.content_type)}
                      {item.content_type}
                    </span>
                    {getMatchBadge(item.match_type)}
                  </div>

                  {/* Relevance Score Badge */}
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-full)',
                      background:
                        matchPercent >= 75
                          ? 'rgba(16, 185, 129, 0.15)'
                          : 'rgba(99, 102, 241, 0.15)',
                      color:
                        matchPercent >= 75
                          ? 'var(--accent-emerald)'
                          : 'var(--accent-primary)',
                      border:
                        matchPercent >= 75
                          ? '1px solid rgba(16, 185, 129, 0.3)'
                          : '1px solid rgba(99, 102, 241, 0.3)',
                    }}
                  >
                    {matchPercent}% Relevance
                  </span>
                </div>

                {/* Title */}
                <h4
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    marginBottom: '0.5rem',
                    lineHeight: 1.35,
                    cursor: 'pointer',
                  }}
                  onClick={() => onSelectCard(cardAdapter)}
                  title="Click to view full card details"
                >
                  {item.title}
                </h4>

                {/* Snippet */}
                <p
                  style={{
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                    lineHeight: 1.5,
                    marginBottom: '1rem',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {item.snippet || 'No excerpt available.'}
                </p>
              </div>

              {/* Footer: Tags & Actions */}
              <div>
                {item.tags && item.tags.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.35rem',
                      marginBottom: '0.85rem',
                    }}
                  >
                    {item.tags.map((t) => (
                      <span
                        key={t.id}
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.45rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(255, 255, 255, 0.04)',
                          color: 'var(--text-dim)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        #{t.name}
                      </span>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.6rem',
                    borderTop: '1px solid var(--border-subtle)',
                  }}
                >
                  <button
                    onClick={() => onSelectCard(cardAdapter)}
                    className="btn btn-secondary"
                    style={{
                      padding: '0.3rem 0.65rem',
                      fontSize: '0.75rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    <ExternalLink size={12} /> View Full
                  </button>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      onClick={() => onEditCard(cardAdapter)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                        padding: '0.35rem',
                        borderRadius: 'var(--radius-sm)',
                      }}
                      title="Edit card"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => onDeleteCard(item.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent-rose)',
                        cursor: 'pointer',
                        padding: '0.35rem',
                        borderRadius: 'var(--radius-sm)',
                      }}
                      title="Delete card"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
