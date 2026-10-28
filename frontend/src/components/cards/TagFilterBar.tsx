import React from 'react';
import { Tag, ContentType } from '../../types/card.js';
import {
  Search,
  Plus,
  FileUp,
  Globe,
  FileText,
  X,
  Layers,
  File,
  FileSpreadsheet,
} from 'lucide-react';

interface TagFilterBarProps {
  tags: Tag[];
  selectedTag?: string;
  onSelectTag: (tag?: string) => void;
  selectedType?: ContentType | 'all';
  onSelectType: (type: ContentType | 'all') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenCreateNote: () => void;
  onOpenUploadPdf: () => void;
  onOpenUploadDocx: () => void;
  onOpenIngestUrl: () => void;
}

export const TagFilterBar: React.FC<TagFilterBarProps> = ({
  tags,
  selectedTag,
  onSelectTag,
  selectedType = 'all',
  onSelectType,
  searchQuery,
  onSearchChange,
  onOpenCreateNote,
  onOpenUploadPdf,
  onOpenUploadDocx,
  onOpenIngestUrl,
}) => {
  const contentTypes: { type: ContentType | 'all'; label: string; icon: React.ReactNode }[] = [
    { type: 'all', label: 'All Cards', icon: <Layers size={14} /> },
    { type: 'note', label: 'Notes', icon: <FileText size={14} /> },
    { type: 'pdf', label: 'PDFs', icon: <File size={14} /> },
    { type: 'docx', label: 'Word (.docx)', icon: <FileSpreadsheet size={14} /> },
    { type: 'link', label: 'Web Links', icon: <Globe size={14} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
      {/* Top Bar: Search & Ingestion Trigger Buttons */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1', minWidth: '280px', maxWidth: '500px' }}>
          <input
            type="text"
            className="input-field"
            placeholder="Filter cards by title or text..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ paddingLeft: '2.5rem', paddingRight: searchQuery ? '2.5rem' : '1rem' }}
          />
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '0.85rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-dim)',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              style={{
                position: 'absolute',
                right: '0.85rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-dim)',
                cursor: 'pointer',
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Ingestion Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={onOpenCreateNote}
            className="btn btn-primary"
            style={{ padding: '0.6rem 0.95rem', fontSize: '0.825rem' }}
          >
            <Plus size={15} />
            <span>Note</span>
          </button>

          <button
            onClick={onOpenUploadPdf}
            className="btn btn-secondary"
            style={{ padding: '0.6rem 0.95rem', fontSize: '0.825rem' }}
          >
            <FileUp size={15} style={{ color: 'var(--accent-rose)' }} />
            <span>Upload PDF</span>
          </button>

          <button
            onClick={onOpenUploadDocx}
            className="btn btn-secondary"
            style={{ padding: '0.6rem 0.95rem', fontSize: '0.825rem' }}
          >
            <FileUp size={15} style={{ color: 'var(--accent-secondary)' }} />
            <span>Upload DOCX</span>
          </button>

          <button
            onClick={onOpenIngestUrl}
            className="btn btn-secondary"
            style={{ padding: '0.6rem 0.95rem', fontSize: '0.825rem' }}
          >
            <Globe size={15} style={{ color: 'var(--accent-emerald)' }} />
            <span>Add Link</span>
          </button>
        </div>
      </div>

      {/* Filter Row: Type Filters & Tags */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '1rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {/* Type Filter Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {contentTypes.map((item) => {
            const isActive = selectedType === item.type;
            return (
              <button
                key={item.type}
                onClick={() => onSelectType(item.type)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.4rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: isActive
                    ? '1px solid var(--accent-primary)'
                    : '1px solid var(--border-subtle)',
                  background: isActive ? 'var(--accent-primary-glow)' : 'rgba(255, 255, 255, 0.03)',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Separator */}
        {tags.length > 0 && (
          <div
            style={{
              width: '1px',
              height: '24px',
              background: 'var(--border-subtle)',
              margin: '0 0.25rem',
            }}
          />
        )}

        {/* Tag Pills */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
          {tags.map((tag) => {
            const isSelected = selectedTag === tag.name;
            return (
              <button
                key={tag.id}
                onClick={() => onSelectTag(isSelected ? undefined : tag.name)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                  border: isSelected
                    ? '1px solid var(--accent-secondary)'
                    : '1px solid var(--border-subtle)',
                  background: isSelected
                    ? 'rgba(14, 165, 233, 0.2)'
                    : 'rgba(255, 255, 255, 0.03)',
                  color: isSelected ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <span>#{tag.name}</span>
                {tag.card_count !== undefined && tag.card_count > 0 && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      background: 'rgba(255, 255, 255, 0.1)',
                      padding: '0.05rem 0.35rem',
                      borderRadius: 'var(--radius-full)',
                    }}
                  >
                    {tag.card_count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
