import React, { useState } from 'react';
import { Navbar } from '../components/common/Navbar.js';
import { useCards } from '../hooks/useCards.js';
import { useTags } from '../hooks/useTags.js';
import { Card, ContentType } from '../types/card.js';
import { TagFilterBar } from '../components/cards/TagFilterBar.js';
import { CardCanvas } from '../components/cards/CardCanvas.js';
import { CreateNoteModal } from '../components/modals/CreateNoteModal.js';
import { UploadPdfModal } from '../components/modals/UploadPdfModal.js';
import { UploadDocxModal } from '../components/modals/UploadDocxModal.js';
import { IngestUrlModal } from '../components/modals/IngestUrlModal.js';
import { CardDetailModal } from '../components/modals/CardDetailModal.js';
import { EditCardModal } from '../components/modals/EditCardModal.js';
import { useSearch } from '../hooks/useSearch.js';
import { HybridSearchBar } from '../components/search/HybridSearchBar.js';
import { SearchResultsGrid } from '../components/search/SearchResultsGrid.js';
import {
  Layers,
  Tag as TagIcon,
  CheckCircle2,
  AlertCircle,
  Cpu,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const {
    cards,
    loading: cardsLoading,
    error: cardsError,
    filters,
    setFilters,
    createNote,
    ingestPdf,
    ingestDocx,
    ingestUrl,
    updateCard,
    deleteCard,
  } = useCards();

  const { tags, fetchTags } = useTags();

  // Phase 3 Hybrid AI Vector Search
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    mode: searchMode,
    setMode: setSearchMode,
    results: searchResults,
    loading: searchLoading,
    total: searchTotal,
    clearSearch,
    isSearching,
  } = useSearch('hybrid');

  // Modal States
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isDocxModalOpen, setIsDocxModalOpen] = useState(false);
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
  const [selectedCardForDetail, setSelectedCardForDetail] = useState<Card | null>(null);
  const [selectedCardForEdit, setSelectedCardForEdit] = useState<Card | null>(null);

  // Success Banner
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    fetchTags(); // refresh tag counts
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Handlers
  const handleCreateNote = async (title: string, content: string, noteTags: string[]) => {
    const card = await createNote(title, content, noteTags);
    showSuccess(`Note "${card.title}" added to your canvas!`);
    return card;
  };

  const handleIngestPdf = async (file: File, title?: string, pdfTags: string[] = []) => {
    const card = await ingestPdf(file, title, pdfTags);
    showSuccess(`PDF "${card.title}" extracted and ingested!`);
    return card;
  };

  const handleIngestDocx = async (file: File, title?: string, docxTags: string[] = []) => {
    const card = await ingestDocx(file, title, docxTags);
    showSuccess(`Word document "${card.title}" ingested!`);
    return card;
  };

  const handleIngestUrl = async (url: string, urlTags: string[] = []) => {
    const card = await ingestUrl(url, urlTags);
    showSuccess(`Web link "${card.title}" successfully ingested!`);
    return card;
  };

  const handleUpdateCard = async (
    cardId: string,
    updates: { title?: string; content?: string; tags?: string[] }
  ) => {
    const card = await updateCard(cardId, updates);
    showSuccess(`Card "${card.title}" updated.`);
    return card;
  };

  const handleDeleteCard = async (cardId: string) => {
    await deleteCard(cardId);
    showSuccess('Card deleted from canvas.');
    fetchTags();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '2rem', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        {/* Header Hero */}
        <div
          className="glass-panel"
          style={{
            padding: '2rem 2.5rem',
            marginBottom: '2rem',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.5rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem' }}>
              <span className="badge badge-indigo">Phase 3 AI Vector Search</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  color: 'var(--accent-emerald)',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                <Cpu size={12} />
                <span>384d Dense Embeddings Active</span>
              </span>
            </div>

            <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.025em' }}>
              Knowledge Canvas
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.925rem', marginTop: '0.25rem' }}>
              Organize, ingest, and explore multi-modal knowledge cards across your library.
            </p>
          </div>

          {/* Quick Stats Counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: 'rgba(255, 255, 255, 0.04)',
                padding: '0.75rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  padding: '0.45rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--accent-primary)',
                }}
              >
                <Layers size={18} />
              </div>
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, lineHeight: 1 }}>{cards.length}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>Total Cards</div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: 'rgba(255, 255, 255, 0.04)',
                padding: '0.75rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  padding: '0.45rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(14, 165, 233, 0.15)',
                  color: 'var(--accent-secondary)',
                }}
              >
                <TagIcon size={18} />
              </div>
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, lineHeight: 1 }}>{tags.length}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>Active Tags</div>
              </div>
            </div>
          </div>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="alert alert-success animate-fade-in">
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {cardsError && (
          <div className="alert alert-error animate-fade-in">
            <AlertCircle size={16} />
            <span>{cardsError}</span>
          </div>
        )}

        {/* Phase 3 Hybrid Vector Search Bar */}
        <HybridSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          mode={searchMode}
          onModeChange={setSearchMode}
          loading={searchLoading}
          onClear={clearSearch}
          resultCount={searchTotal}
        />

        {/* Display Search Results OR Standard Canvas */}
        {isSearching ? (
          <SearchResultsGrid
            results={searchResults}
            query={searchQuery}
            mode={searchMode}
            onSelectCard={(c) => setSelectedCardForDetail(c)}
            onEditCard={(c) => setSelectedCardForEdit(c)}
            onDeleteCard={handleDeleteCard}
            onClear={clearSearch}
          />
        ) : (
          <>
            {/* Tag & Search Filter Bar */}
            <TagFilterBar
              tags={tags}
              selectedTag={filters.tag}
              onSelectTag={(tag) => setFilters((prev) => ({ ...prev, tag }))}
              selectedType={filters.contentType || 'all'}
              onSelectType={(contentType: ContentType | 'all') =>
                setFilters((prev) => ({ ...prev, contentType }))
              }
              searchQuery={filters.search || ''}
              onSearchChange={(search) => setFilters((prev) => ({ ...prev, search }))}
              onOpenCreateNote={() => setIsNoteModalOpen(true)}
              onOpenUploadPdf={() => setIsPdfModalOpen(true)}
              onOpenUploadDocx={() => setIsDocxModalOpen(true)}
              onOpenIngestUrl={() => setIsUrlModalOpen(true)}
            />

            {/* Main Card Canvas */}
            <CardCanvas
              cards={cards}
              loading={cardsLoading}
              onViewDetail={(card) => setSelectedCardForDetail(card)}
              onEdit={(card) => setSelectedCardForEdit(card)}
              onDelete={handleDeleteCard}
              onOpenCreateNote={() => setIsNoteModalOpen(true)}
              onOpenUploadPdf={() => setIsPdfModalOpen(true)}
              onOpenUploadDocx={() => setIsDocxModalOpen(true)}
              onOpenIngestUrl={() => setIsUrlModalOpen(true)}
            />
          </>
        )}
      </main>

      {/* Modals Suite */}
      <CreateNoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        onSubmit={handleCreateNote}
      />

      <UploadPdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onSubmit={handleIngestPdf}
      />

      <UploadDocxModal
        isOpen={isDocxModalOpen}
        onClose={() => setIsDocxModalOpen(false)}
        onSubmit={handleIngestDocx}
      />

      <IngestUrlModal
        isOpen={isUrlModalOpen}
        onClose={() => setIsUrlModalOpen(false)}
        onSubmit={handleIngestUrl}
      />

      <CardDetailModal
        card={selectedCardForDetail}
        isOpen={!!selectedCardForDetail}
        onClose={() => setSelectedCardForDetail(null)}
        onEdit={(card) => {
          setSelectedCardForDetail(null);
          setSelectedCardForEdit(card);
        }}
        onDelete={(id) => {
          setSelectedCardForDetail(null);
          handleDeleteCard(id);
        }}
      />

      <EditCardModal
        card={selectedCardForEdit}
        isOpen={!!selectedCardForEdit}
        onClose={() => setSelectedCardForEdit(null)}
        onSubmit={handleUpdateCard}
      />
    </div>
  );
};
