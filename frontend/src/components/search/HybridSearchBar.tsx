import React from 'react';
import { SearchMode } from '../../types/search.js';
import { Search, Sparkles, Brain, FileText, X, Loader2 } from 'lucide-react';

interface HybridSearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  mode: SearchMode;
  onModeChange: (m: SearchMode) => void;
  loading: boolean;
  onClear: () => void;
  resultCount?: number;
}

export const HybridSearchBar: React.FC<HybridSearchBarProps> = ({
  query,
  onQueryChange,
  mode,
  onModeChange,
  loading,
  onClear,
  resultCount,
}) => {
  const modes: Array<{ id: SearchMode; label: string; icon: React.ReactNode; desc: string }> = [
    {
      id: 'hybrid',
      label: 'Hybrid Search',
      icon: <Sparkles size={14} />,
      desc: 'Fused dense vector similarity + full-text search',
    },
    {
      id: 'semantic',
      label: 'Semantic Vector',
      icon: <Brain size={14} />,
      desc: 'all-MiniLM-L6-v2 384d vector embeddings',
    },
    {
      id: 'exact',
      label: 'Exact Keyword',
      icon: <FileText size={14} />,
      desc: 'PostgreSQL GIN full-text search',
    },
  ];

  return (
    <div
      className="glass-panel"
      style={{
        padding: '1.25rem 1.5rem',
        marginBottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        position: 'relative',
        border: query.trim() ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid var(--border-subtle)',
        boxShadow: query.trim() ? '0 8px 32px -4px rgba(99, 102, 241, 0.15)' : 'none',
        transition: 'all var(--transition-normal)',
      }}
    >
      {/* Top Bar: Input & Clear */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              position: 'absolute',
              left: '1rem',
              color: query.trim() ? 'var(--accent-primary)' : 'var(--text-dim)',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            {loading ? (
              <Loader2 size={18} className="spin-animation" style={{ color: 'var(--accent-primary)' }} />
            ) : (
              <Search size={18} />
            )}
          </div>

          <input
            type="text"
            className="input-field"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search notes, PDFs, docs, and URLs with hybrid AI vector search..."
            style={{
              width: '100%',
              paddingLeft: '2.75rem',
              paddingRight: query.trim() ? '2.5rem' : '1rem',
              fontSize: '0.95rem',
              height: '46px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(15, 23, 42, 0.65)',
            }}
          />

          {query.trim() && (
            <button
              onClick={onClear}
              style={{
                position: 'absolute',
                right: '0.75rem',
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {query.trim() && resultCount !== undefined && (
          <div
            className="badge badge-indigo"
            style={{
              padding: '0.45rem 0.8rem',
              fontSize: '0.8rem',
              whiteSpace: 'nowrap',
              height: '46px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {resultCount} {resultCount === 1 ? 'match' : 'matches'}
          </div>
        )}
      </div>

      {/* Mode Selector Toggle Pills */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-dim)', marginRight: '0.25rem' }}>
          Search Engine Mode:
        </span>
        {modes.map((m) => {
          const isActive = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onModeChange(m.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.775rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                border: isActive
                  ? '1px solid rgba(99, 102, 241, 0.6)'
                  : '1px solid var(--border-subtle)',
                background: isActive
                  ? 'rgba(99, 102, 241, 0.2)'
                  : 'rgba(255, 255, 255, 0.03)',
                color: isActive ? '#ffffff' : 'var(--text-muted)',
              }}
              title={m.desc}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
