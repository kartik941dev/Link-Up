import React, { useState, useRef } from 'react';
import { X, FolderArchive, Loader2, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { BatchIngestResult } from '../../hooks/useCards.js';

interface UploadZipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (file: File, tags?: string[]) => Promise<BatchIngestResult>;
}

export const UploadZipModal: React.FC<UploadZipModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchIngestResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const pickFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Unsupported file type. Please select a valid .zip archive.');
      return;
    }
    setSelectedFile(file);
    setResult(null);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      pickFile(e.target.files[0]);
      e.target.value = '';
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    setTags([]);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a ZIP file to upload.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await onSubmit(selectedFile, tags);
      setResult(res);
      setSelectedFile(null);
    } catch (err: any) {
      setError(err.message || 'Failed to extract and ingest ZIP archive.');
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
      onClick={handleClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '600px',
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
                background: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--accent-amber)',
              }}
            >
              <FolderArchive size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Upload ZIP Archive</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Automatically extracts and ingests PDFs, DOCX documents, Markdown notes, and links.json
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {result && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div className="alert alert-success" style={{ marginBottom: '0.75rem' }}>
              <CheckCircle2 size={16} />
              <span>{result.message}</span>
            </div>

            {result.skipped && result.skipped.length > 0 && (
              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  fontSize: '0.78rem',
                  color: '#fde68a',
                  maxHeight: '160px',
                  overflowY: 'auto',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                  <AlertTriangle size={14} />
                  <span>Skipped / Warnings ({result.skipped.length}):</span>
                </div>
                {result.skipped.map((s, idx) => (
                  <div key={idx} style={{ marginBottom: '0.25rem' }}>
                    <strong>{s.filename}:</strong> {s.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) pickFile(e.dataTransfer.files[0]);
            }}
            style={{
              border: '2px dashed var(--border-active)',
              borderRadius: 'var(--radius-md)',
              padding: '2rem 1.5rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'rgba(255, 255, 255, 0.02)',
              marginBottom: '1.25rem',
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".zip,application/zip,application/x-zip-compressed"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {selectedFile ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem' }}>
                <FolderArchive size={32} style={{ color: 'var(--accent-amber)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                  {selectedFile.name}
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                  {(selectedFile.size / 1024).toFixed(1)} KB • Ready to extract & ingest all supported files
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.45rem' }}>
                <FolderArchive size={32} style={{ color: 'var(--accent-amber)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                  Click or drag a .zip archive here
                </span>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>
                  Up to 50 MB • Extracts .pdf, .docx, .md notes & links.json; skips unsupported files cleanly
                </span>
              </div>
            )}
          </div>

          <div className="input-group" style={{ marginBottom: '1.5rem' }}>
            <label className="input-label">Optional Shared Tags for All Extracted Cards</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                className="input-field"
                placeholder="Add optional tag and press Enter..."
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
                      background: 'rgba(245, 158, 11, 0.15)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      color: '#fcd34d',
                      fontSize: '0.75rem',
                    }}
                  >
                    <span>#{t}</span>
                    <X
                      size={12}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setTags(tags.filter((x) => x !== t))}
                    />
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="button" onClick={handleClose} className="btn btn-secondary">
              {result ? 'Done' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !selectedFile}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Extracting & Ingesting ZIP...</span>
                </>
              ) : (
                <span>Extract & Ingest ZIP</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
