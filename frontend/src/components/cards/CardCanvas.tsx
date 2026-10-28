import React from 'react';
import { Card } from '../../types/card.js';
import { CardItem } from './CardItem.js';
import { Layers, Plus, FileUp, Globe } from 'lucide-react';

interface CardCanvasProps {
  cards: Card[];
  loading: boolean;
  onViewDetail: (card: Card) => void;
  onEdit: (card: Card) => void;
  onDelete: (cardId: string) => void;
  onOpenCreateNote: () => void;
  onOpenUploadPdf: () => void;
  onOpenUploadDocx: () => void;
  onOpenIngestUrl: () => void;
}

export const CardCanvas: React.FC<CardCanvasProps> = ({
  cards,
  loading,
  onViewDetail,
  onEdit,
  onDelete,
  onOpenCreateNote,
  onOpenUploadPdf,
  onOpenUploadDocx,
  onOpenIngestUrl,
}) => {
  if (loading) {
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="glass-panel"
            style={{
              height: '240px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              animation: 'pulse 1.5s infinite ease-in-out',
            }}
          >
            <div style={{ width: '30%', height: '20px', background: 'rgba(255, 255, 255, 0.06)', borderRadius: 'var(--radius-sm)' }} />
            <div style={{ width: '80%', height: '24px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: 'var(--radius-sm)' }} />
            <div style={{ width: '100%', height: '60px', background: 'rgba(255, 255, 255, 0.04)', borderRadius: 'var(--radius-sm)' }} />
            <div style={{ width: '50%', height: '20px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-sm)', marginTop: 'auto' }} />
          </div>
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div
        className="glass-panel"
        style={{
          padding: '4rem 2rem',
          textAlign: 'center',
          borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--border-active)',
          background: 'rgba(15, 23, 42, 0.4)',
        }}
      >
        <div
          className="brand-icon"
          style={{ width: '56px', height: '56px', margin: '0 auto 1.25rem', borderRadius: 'var(--radius-lg)' }}
        >
          <Layers size={28} />
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
          Your Knowledge Canvas is Empty
        </h2>
        <p style={{ color: 'var(--text-muted)', maxWidth: '520px', margin: '0 auto 2rem', fontSize: '0.95rem' }}>
          Ingest knowledge to begin. LinkUp automatically extracts semantic text, discovers knowledge graph connections, and powers agentic search.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button onClick={onOpenCreateNote} className="btn btn-primary">
            <Plus size={16} />
            <span>Create Rich Note</span>
          </button>
          <button onClick={onOpenUploadPdf} className="btn btn-secondary">
            <FileUp size={16} style={{ color: 'var(--accent-rose)' }} />
            <span>Upload PDF</span>
          </button>
          <button onClick={onOpenUploadDocx} className="btn btn-secondary">
            <FileUp size={16} style={{ color: 'var(--accent-secondary)' }} />
            <span>Upload DOCX</span>
          </button>
          <button onClick={onOpenIngestUrl} className="btn btn-secondary">
            <Globe size={16} style={{ color: 'var(--accent-emerald)' }} />
            <span>Add Web Link</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '1.5rem',
      }}
    >
      {cards.map((card) => (
        <CardItem
          key={card.id}
          card={card}
          onViewDetail={onViewDetail}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};
