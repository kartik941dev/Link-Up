import React from 'react';
import { FileText, File, FileSpreadsheet, Globe, ExternalLink } from 'lucide-react';
import { RAGCitation } from '../../types/chat.js';

interface CitationBadgeProps {
  citation: RAGCitation;
  onOpenCard: (cardId: string) => void;
}

export const CitationBadge: React.FC<CitationBadgeProps> = ({ citation, onOpenCard }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <File size={12} style={{ color: '#fb7185' }} />;
      case 'docx':
        return <FileSpreadsheet size={12} style={{ color: '#38bdf8' }} />;
      case 'link':
        return <Globe size={12} style={{ color: '#34d399' }} />;
      default:
        return <FileText size={12} style={{ color: '#818cf8' }} />;
    }
  };

  return (
    <button
      onClick={() => onOpenCard(citation.card_id)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.2rem 0.55rem',
        margin: '0.15rem 0.25rem',
        borderRadius: 'var(--radius-full)',
        background: 'rgba(99, 102, 241, 0.12)',
        border: '1px solid rgba(99, 102, 241, 0.35)',
        color: '#c7d2fe',
        fontSize: '0.74rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        verticalAlign: 'middle',
      }}
      title={`View card: ${citation.title}\n${citation.snippet ? citation.snippet.slice(0, 100) + '...' : ''}`}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(99, 102, 241, 0.28)';
        e.currentTarget.style.borderColor = 'var(--accent-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)';
        e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.35)';
      }}
    >
      {getIcon(citation.content_type)}
      <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {citation.title}
      </span>
      <ExternalLink size={10} style={{ opacity: 0.7 }} />
    </button>
  );
};
