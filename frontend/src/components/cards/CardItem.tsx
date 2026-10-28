import React from 'react';
import { Card, ContentType } from '../../types/card.js';
import {
  FileText,
  File,
  FileSpreadsheet,
  Globe,
  Tag as TagIcon,
  Trash2,
  Edit2,
  ExternalLink,
  Calendar,
  Maximize2,
} from 'lucide-react';

interface CardItemProps {
  card: Card;
  onViewDetail: (card: Card) => void;
  onEdit: (card: Card) => void;
  onDelete: (cardId: string) => void;
}

export const CardItem: React.FC<CardItemProps> = ({
  card,
  onViewDetail,
  onEdit,
  onDelete,
}) => {
  const getTypeBadge = (type: ContentType) => {
    switch (type) {
      case 'note':
        return {
          label: 'Note',
          icon: <FileText size={13} />,
          color: '#818cf8',
          bg: 'rgba(99, 102, 241, 0.15)',
          border: 'rgba(99, 102, 241, 0.3)',
        };
      case 'pdf':
        return {
          label: 'PDF Document',
          icon: <File size={13} />,
          color: '#fb7185',
          bg: 'rgba(244, 63, 94, 0.15)',
          border: 'rgba(244, 63, 94, 0.3)',
        };
      case 'docx':
        return {
          label: 'Word Document',
          icon: <FileSpreadsheet size={13} />,
          color: '#38bdf8',
          bg: 'rgba(14, 165, 233, 0.15)',
          border: 'rgba(14, 165, 233, 0.3)',
        };
      case 'link':
        return {
          label: card.metadata?.siteName || 'Web Link',
          icon: <Globe size={13} />,
          color: '#34d399',
          bg: 'rgba(16, 185, 129, 0.15)',
          border: 'rgba(16, 185, 129, 0.3)',
        };
    }
  };

  const badge = getTypeBadge(card.content_type);
  const formattedDate = new Date(card.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const previewImage = card.metadata?.imageUrl;

  return (
    <div
      className="glass-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        position: 'relative',
        transition: 'all var(--transition-smooth)',
        cursor: 'pointer',
      }}
      onClick={() => onViewDetail(card)}
    >
      {/* Optional Preview Image for URLs */}
      {previewImage && (
        <div
          style={{
            width: '100%',
            height: '140px',
            overflow: 'hidden',
            position: 'relative',
            background: '#090d16',
          }}
        >
          <img
            src={previewImage}
            alt={card.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform 0.4s ease',
            }}
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(15, 23, 42, 0.9) 0%, transparent 60%)',
            }}
          />
        </div>
      )}

      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Header: Content Badge & Date */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.75rem',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.2rem 0.55rem',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.72rem',
              fontWeight: 600,
              color: badge.color,
              background: badge.bg,
              border: `1px solid ${badge.border}`,
            }}
          >
            {badge.icon}
            <span>{badge.label}</span>
          </span>

          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.72rem',
              color: 'var(--text-dim)',
            }}
          >
            <Calendar size={12} />
            {formattedDate}
          </span>
        </div>

        {/* Card Title */}
        <h3
          style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            lineHeight: 1.35,
            color: 'var(--text-main)',
            marginBottom: '0.65rem',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {card.title}
        </h3>

        {/* Snippet */}
        <p
          style={{
            fontSize: '0.84rem',
            color: 'var(--text-muted)',
            lineHeight: 1.5,
            marginBottom: '1rem',
            flex: 1,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {card.snippet || card.extracted_text || card.raw_content || 'No content preview available.'}
        </p>

        {/* Tags */}
        {card.tags && card.tags.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.35rem',
              marginBottom: '1rem',
            }}
          >
            {card.tags.slice(0, 4).map((tag) => (
              <span
                key={tag.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                }}
              >
                <TagIcon size={10} style={{ color: 'var(--accent-secondary)' }} />
                <span>{tag.name}</span>
              </span>
            ))}
            {card.tags.length > 4 && (
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.4rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  color: 'var(--text-dim)',
                }}
              >
                +{card.tags.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '0.75rem',
            borderTop: '1px solid var(--border-subtle)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onViewDetail(card)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.78rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            <Maximize2 size={13} />
            <span>Open</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {card.content_type === 'link' && card.metadata?.url && (
              <a
                href={card.metadata.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '0.35rem',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-muted)',
                  display: 'inline-flex',
                  textDecoration: 'none',
                }}
                title="Visit link"
              >
                <ExternalLink size={14} />
              </a>
            )}

            <button
              onClick={() => onEdit(card)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0.35rem',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'inline-flex',
              }}
              title="Edit card"
            >
              <Edit2 size={14} />
            </button>

            <button
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete "${card.title}"?`)) {
                  onDelete(card.id);
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0.35rem',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--accent-rose)',
                cursor: 'pointer',
                display: 'inline-flex',
              }}
              title="Delete card"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
