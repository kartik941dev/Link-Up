import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage, RAGCitation } from '../../types/chat.js';
import { CitationBadge } from './CitationBadge.js';
import {
  Bot,
  User,
  ShieldCheck,
  AlertTriangle,
  Network,
  Clock,
  Layers,
} from 'lucide-react';

interface ChatMessageItemProps {
  message: ChatMessage;
  onOpenCard: (cardId: string) => void;
}

const CITATION_HREF_PREFIX = '#linkup-citation-';

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({ message, onOpenCard }) => {
  const isUser = message.role === 'user';

  const citationMap = useMemo(() => {
    const map = new Map<string, RAGCitation>();
    if (message.citations) {
      for (const cit of message.citations) {
        map.set(cit.card_id, cit);
      }
    }
    return map;
  }, [message.citations]);

  // Convert [Card: <id> - <title>] tokens into safe internal markdown links so
  // ReactMarkdown renders bold, tables, lists, code blocks AND interactive CitationBadges together.
  const preparedMarkdown = useMemo(() => {
    if (isUser) return message.content;
    return message.content.replace(
      /\[Card:\s*([0-9a-fA-F-]+)(?:\s*-\s*([^\]]+))?\]/g,
      (_match, cardId: string, rawTitle?: string) => {
        const cleanTitle = (rawTitle || citationMap.get(cardId)?.title || 'Cited Source')
          .replace(/[\[\]()]/g, '')
          .trim();
        return `[${cleanTitle}](${CITATION_HREF_PREFIX}${cardId})`;
      }
    );
  }, [isUser, message.content, citationMap]);

  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Show the Grounded badge ONLY on answers that actually have citations (never on greeting or uncited errors)
  const hasCitations = Boolean(message.citations && message.citations.length > 0);
  const showVerificationFooter =
    !isUser &&
    message.id !== 'welcome-msg' &&
    Boolean(message.verification) &&
    hasCitations;

  return (
    <div
      style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.75rem',
        maxWidth: '100%',
        alignItems: 'flex-start',
        flexDirection: isUser ? 'row-reverse' : 'row',
      }}
    >
      {/* Avatar Icon */}
      <div
        style={{
          width: '38px',
          height: '38px',
          borderRadius: 'var(--radius-md)',
          background: isUser
            ? 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)'
            : 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          flexShrink: 0,
          boxShadow: isUser
            ? '0 4px 12px rgba(56, 189, 248, 0.3)'
            : '0 4px 12px rgba(99, 102, 241, 0.3)',
        }}
      >
        {isUser ? <User size={19} /> : <Bot size={19} />}
      </div>

      {/* Message Content Bubble */}
      <div
        style={{
          maxWidth: isUser ? '75%' : '85%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
        }}
      >
        {/* Author & Timestamp */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.4rem',
            fontSize: '0.75rem',
            color: 'var(--text-dim)',
          }}
        >
          <span style={{ fontWeight: 600, color: isUser ? '#38bdf8' : '#818cf8' }}>
            {isUser ? 'You' : 'LinkUp Agentic AI'}
          </span>
          <span>•</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Clock size={11} /> {formattedTime}
          </span>
        </div>

        {/* Bubble Box */}
        <div
          className="glass-panel"
          style={{
            padding: '1.25rem 1.5rem',
            borderRadius: isUser
              ? 'var(--radius-lg) 0px var(--radius-lg) var(--radius-lg)'
              : '0px var(--radius-lg) var(--radius-lg) var(--radius-lg)',
            background: isUser
              ? 'rgba(14, 165, 233, 0.12)'
              : 'rgba(30, 41, 59, 0.75)',
            border: isUser
              ? '1px solid rgba(14, 165, 233, 0.35)'
              : '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-md)',
            color: 'var(--text-main)',
            fontSize: '0.94rem',
            lineHeight: 1.65,
            wordBreak: 'break-word',
          }}
        >
          {isUser ? (
            <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
          ) : (
            <div className="chat-markdown">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => {
                    if (href && href.startsWith(CITATION_HREF_PREFIX)) {
                      const cardId = href.slice(CITATION_HREF_PREFIX.length);
                      const fallbackTitle = String(children || 'Cited Source');
                      const existingCitation = citationMap.get(cardId) || {
                        card_id: cardId,
                        title: fallbackTitle,
                        content_type: 'note',
                        snippet: '',
                      };
                      return (
                        <CitationBadge
                          citation={existingCitation}
                          onOpenCard={onOpenCard}
                        />
                      );
                    }
                    // Allow only safe http(s) links (prevents javascript: XSS)
                    const safeHref =
                      href && /^https?:\/\//i.test(href) ? href : undefined;
                    if (!safeHref) {
                      return <span>{children}</span>;
                    }
                    return (
                      <a href={safeHref} target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {preparedMarkdown}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Grounding & Verification Metadata Footer (ONLY on cited answers, never greeting) */}
        {showVerificationFooter && message.verification && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.75rem',
              marginTop: '0.65rem',
            }}
          >
            {/* Groundedness Confidence Badge */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.72rem',
                fontWeight: 600,
                background: message.verification.grounded
                  ? 'rgba(16, 185, 129, 0.12)'
                  : 'rgba(245, 158, 11, 0.12)',
                border: message.verification.grounded
                  ? '1px solid rgba(16, 185, 129, 0.35)'
                  : '1px solid rgba(245, 158, 11, 0.35)',
                color: message.verification.grounded ? '#34d399' : '#fbbf24',
              }}
            >
              {message.verification.grounded ? (
                <ShieldCheck size={13} />
              ) : (
                <AlertTriangle size={13} />
              )}
              <span>
                {Math.round(message.verification.confidence * 100)}% Grounded
              </span>
            </span>

            {/* Graph Expansion Indicator */}
            {message.graphExpansionUsed && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.7rem',
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  color: '#a5b4fc',
                }}
              >
                <Network size={11} />
                <span>Knowledge Graph Context</span>
              </span>
            )}

            {/* Retrieved cards count */}
            {message.retrievedCardsCount !== undefined && message.retrievedCardsCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  fontSize: '0.7rem',
                  color: 'var(--text-dim)',
                }}
              >
                <Layers size={11} />
                <span>{message.retrievedCardsCount} cards analyzed</span>
              </span>
            )}
          </div>
        )}

        {/* Source Cards List Preview */}
        {!isUser && hasCitations && message.citations && (
          <div
            style={{
              marginTop: '0.85rem',
              padding: '0.65rem 0.9rem',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(15, 23, 42, 0.45)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              maxWidth: '100%',
            }}
          >
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
              Verified Source References:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {message.citations.map((c) => (
                <CitationBadge key={c.card_id} citation={c} onOpenCard={onOpenCard} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
