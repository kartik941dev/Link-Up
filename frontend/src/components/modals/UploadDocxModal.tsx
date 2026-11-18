import React, { useState, useRef } from 'react';
import { X, FileUp, Loader2, FileSpreadsheet, Plus, Trash2 } from 'lucide-react';
import { BatchIngestResult } from '../../hooks/useCards.js';

interface UploadDocxModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (file: File, title?: string, tags?: string[]) => Promise<any>;
  onSubmitBatch?: (files: File[], tags?: string[]) => Promise<BatchIngestResult>;
}

export const UploadDocxModal: React.FC<UploadDocxModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onSubmitBatch,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [customTitle, setCustomTitle] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const invalid = arr.filter((f) => !f.name.toLowerCase().endsWith('.docx'));
    const valid = arr.filter((f) => f.name.toLowerCase().endsWith('.docx'));

    if (invalid.length > 0) {
      setError(
        `Unsupported file type: ${invalid.map((f) => f.name).join(', ')}. Only .docx Word documents are allowed here.`
      );
    } else {
      setError(null);
    }

    if (valid.length > 0) {
      setSelectedFiles((prev) => {
        const existingNames = new Set(prev.map((f) => `${f.name}:${f.size}`));
        const deduped = valid.filter((f) => !existingNames.has(`${f.name}:${f.size}`));
        return [...prev, ...deduped];
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((tag) => tag !== t));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setError('Please select one or more Word (.docx) files to upload.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      if (selectedFiles.length === 1) {
        await onSubmit(selectedFiles[0], customTitle.trim() || undefined, tags);
      } else if (onSubmitBatch) {
        await onSubmitBatch(selectedFiles, tags);
      } else {
        for (const f of selectedFiles) {
          await onSubmit(f, undefined, tags);
        }
      }
      setSelectedFiles([]);
      setCustomTitle('');
      setTags([]);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to ingest Word document(s).');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(5, 8, 15, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '580px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'rgba(15, 23, 42, 0.96)',
          padding: '2rem',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                padding: '0.45rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(14, 165, 233, 0.15)',
                color: 'var(--accent-secondary)',
              }}
            >
              <FileUp size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Upload Word Document(s)</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Select one or multiple .docx files at once • Content keywords are auto-generated
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Multi-File Picker */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
            }}
            style={{
              border: '2px dashed var(--border-active)',
              borderRadius: 'var(--radius-md)',
              padding: '1.75rem 1.25rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'rgba(255, 255, 255, 0.02)',
              marginBottom: '1.15rem',
            }}
          >
            <input
              type="file"
              multiple
              ref={fileInputRef}
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem' }}>
              <FileUp size={30} style={{ color: 'var(--accent-secondary)' }} />
              <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                Click or drag one or more Word (.docx) files here
              </span>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                Up to 30 DOCX files per batch • Clean heading & body parsing via Mammoth
              </span>
            </div>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
                marginBottom: '1.15rem',
                maxHeight: '160px',
                overflowY: 'auto',
              }}
            >
              {selectedFiles.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                    <FileSpreadsheet size={15} style={{ color: 'var(--accent-secondary)', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.84rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {file.name}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', flexShrink: 0 }}>
                      ({file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / (1024 * 1024)).toFixed(2)} MB`})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(idx)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
                    title="Remove file"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {selectedFiles.length <= 1 && (
            <div className="input-group">
              <label className="input-label">Custom Title (Optional)</label>
              <input
                type="text"
                className="input-field"
                placeholder="Leave blank to use the document's first heading"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
              />
            </div>
          )}

          <div className="input-group" style={{ marginBottom: '1.5rem' }}>
            <label className="input-label">Additional Tags (Optional — AI auto-tags content keywords)</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                className="input-field"
                placeholder="Add optional content tag and press Enter..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="btn btn-secondary"
                style={{ padding: '0 0.85rem' }}
              >
                <Plus size={16} />
              </button>
            </div>

            {tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {tags.map((t) => (
                  <span
                    key={t}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-full)',
                      background: 'rgba(14, 165, 233, 0.15)',
                      border: '1px solid rgba(14, 165, 233, 0.3)',
                      color: '#7dd3fc',
                      fontSize: '0.75rem',
                    }}
                  >
                    <span>#{t}</span>
                    <X
                      size={12}
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleRemoveTag(t)}
                    />
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || selectedFiles.length === 0}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Extracting {selectedFiles.length} DOCX...</span>
                </>
              ) : (
                <span>
                  Ingest {selectedFiles.length > 1 ? `${selectedFiles.length} Documents` : 'Document'}
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
