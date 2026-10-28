import React, { useState } from 'react';
import { Card } from '../../types/card.js';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Calendar,
  Tag as TagIcon,
  FileText,
  File,
  FileSpreadsheet,
  Globe,
  Trash2,
  Edit2,
  Info,
} from 'lucide-react';

interface CardDetailModalProps {
  card: Card | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (card: Card) => void;
  onDelete: (cardId: string) => void;
}

export const CardDetailModal: React.FC<CardDetailModalProps> = ({
  card,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}) => {
  const [copied, setCopied] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  if (!isOpen || !card) return null;

  const handleCopy = () => {
    const textToCopy = card.extracted_text || card.raw_content || card.title;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTypeIcon = () => {
    switch (card.content_type) {
      case 'note':
        return <FileText size={18} style={{ color: 'var(--accent-primary)' }} />;
      case 'pdf':
        return <File size={18} style={{ color: 'var(--accent-rose)' }} />;
      case 'docx':
        return <FileSpreadsheet size={18} style={{ color: 'var(--accent-secondary)' }} />;
      case 'link':
        return <Globe size={18} style={{ color: 'var(--accent-emerald)' }} />;
    }
  };

  const previewImage = card.metadata?.imageUrl;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(5, 8, 15, 0.8)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '780px',
          maxHeight: '90vh',
          background: 'rgba(15, 23, 42, 0.95)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 30px 70px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.5rem 2rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem' }}>
            <div
              style={{
                padding: '0.55rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '0.2rem',
              }}
            >
              {getTypeIcon()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <span className="badge badge-indigo" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                  {card.content_type}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Calendar size={12} />
                  {new Date(card.created_at).toLocaleString()}
                </span>
              </div>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.3 }}>
                {card.title}
              </h1>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              padding: '0.4rem',
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '2rem', overflowY: 'auto', flex: 1 }}>
          {/* Optional Image Header */}
          {previewImage && (
            <div
              style={{
                width: '100%',
                maxHeight: '260px',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                marginBottom: '1.5rem',
              }}
            >
              <img
                src={previewImage}
                alt={card.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          )}

          {/* Tags list */}
          {card.tags && card.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.5rem' }}>
              {card.tags.map((t) => (
                <span
                  key={t.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.78rem',
                    padding: '0.25rem 0.65rem',
                    borderRadius: 'var(--radius-full)',
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#a5b4fc',
                  }}
                >
                  <TagIcon size={12} />
                  <span>#{t.name}</span>
                </span>
              ))}
            </div>
          )}

          {/* Full Extracted Text */}
          <div
            style={{
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
              color: 'var(--text-main)',
              fontSize: '0.925rem',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              maxHeight: '400px',
              overflowY: 'auto',
            }}
          >
            {card.extracted_text || card.raw_content || 'No text extracted.'}
          </div>

          {/* Metadata Collapsible */}
          {card.metadata && Object.keys(card.metadata).length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <button
                onClick={() => setShowMetadata(!showMetadata)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                <Info size={14} />
                <span>{showMetadata ? 'Hide Technical Metadata' : 'Show Technical Metadata'}</span>
              </button>

              {showMetadata && (
                <pre
                  style={{
                    marginTop: '0.75rem',
                    padding: '1rem',
                    background: 'rgba(0, 0, 0, 0.4)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    overflowX: 'auto',
                  }}
                >
                  {JSON.stringify(card.metadata, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 2rem',
            borderTop: '1px solid var(--border-subtle)',
            background: 'rgba(10, 15, 29, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={handleCopy}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}
            >
              {copied ? (
                <>
                  <Check size={14} style={{ color: 'var(--accent-emerald)' }} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Text</span>
                </>
              )}
            </button>

            {card.content_type === 'link' && card.metadata?.url && (
              <a
                href={card.metadata.url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}
              >
                <ExternalLink size={14} />
                <span>Visit Source</span>
              </a>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => {
                onClose();
                onEdit(card);
              }}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem' }}
            >
              <Edit2 size={14} />
              <span>Edit</span>
            </button>

            <button
              onClick={() => {
                if (window.confirm(`Delete "${card.title}"?`)) {
                  onClose();
                  onDelete(card.id);
                }
              }}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', color: 'var(--accent-rose)' }}
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
