import React, { useState, useRef, useEffect } from 'react';
import { Navbar } from '../components/common/Navbar.js';
import { useChat } from '../hooks/useChat.js';
import { ChatMessageItem } from '../components/chat/ChatMessageItem.js';
import { CardDetailModal } from '../components/modals/CardDetailModal.js';
import { Card } from '../types/card.js';
import { api } from '../utils/api.js';
import {
  Bot,
  Send,
  Sparkles,
  Trash2,
  ShieldCheck,
  Loader2,
  Compass,
} from 'lucide-react';

export const ChatPage: React.FC = () => {
  const { messages, loading, sendMessage, clearChat } = useChat();
  const [inputText, setInputText] = useState('');
  const [selectedCardForDetail, setSelectedCardForDetail] = useState<Card | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of conversation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = () => {
    if (!inputText.trim() || loading) return;
    sendMessage(inputText);
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Open full card in modal when citation pill is clicked
  const handleOpenCard = async (cardId: string) => {
    try {
      const res = await api.get<{ card: Card }>(`/cards/${cardId}`);
      if (res.data.card) {
        setSelectedCardForDetail(res.data.card);
      }
    } catch (err) {
      console.warn('Failed to fetch cited card details:', err);
    }
  };

  const samplePrompts = [
    'What are the key concepts and topics in my knowledge cards?',
    'Summarize my notes on deep learning and neural network architectures.',
    'Explain how database indexing connects with vector search.',
    'Which cards have the highest centrality in my knowledge graph?',
  ];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      <Navbar />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
          padding: '1.25rem 2rem 1.5rem',
          overflow: 'hidden',
        }}
      >
        {/* Chat Header Bar */}
        <div
          className="glass-panel"
          style={{
            padding: '1rem 1.5rem',
            marginBottom: '1rem',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #6366f1 0%, #38bdf8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
              }}
            >
              <Bot size={20} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                  LinkUp Agentic AI Assistant
                </h1>
                <span className="badge badge-indigo" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Sparkles size={11} /> Groq Llama 3.1
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--accent-emerald)',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontWeight: 600,
                  }}
                >
                  <ShieldCheck size={12} /> Hallucination Verifier
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.2rem 0 0 0' }}>
                Multi-hop graph retrieval with strict citation grounding & automated factual verification
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <button
              onClick={clearChat}
              className="btn btn-secondary"
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              title="Reset conversation"
            >
              <Trash2 size={13} />
              <span>Clear Chat</span>
            </button>
          </div>
        </div>

        {/* Message Thread Container */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem 0.5rem',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {messages.map((msg) => (
            <ChatMessageItem key={msg.id} message={msg} onOpenCard={handleOpenCard} />
          ))}

          {/* Loading Indicator Bubble */}
          {loading && (
            <div
              style={{
                display: 'flex',
                gap: '1rem',
                alignItems: 'flex-start',
                marginBottom: '1.5rem',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                }}
              >
                <Bot size={19} />
              </div>

              <div
                className="glass-panel"
                style={{
                  padding: '1rem 1.25rem',
                  borderRadius: '0px var(--radius-lg) var(--radius-lg) var(--radius-lg)',
                  background: 'rgba(30, 41, 59, 0.75)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: 'var(--text-muted)',
                  fontSize: '0.88rem',
                }}
              >
                <Loader2 size={16} className="spin" style={{ color: 'var(--accent-primary)' }} />
                <span>Traversing knowledge graph & synthesizing verified response...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Prompt Suggestions */}
        {messages.length <= 2 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginBottom: '0.85rem',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-dim)', fontSize: '0.76rem', marginRight: '0.25rem' }}>
              <Compass size={13} /> Try asking:
            </div>
            {samplePrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInputText(prompt);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-full)',
                  padding: '0.3rem 0.75rem',
                  fontSize: '0.76rem',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Chat Input Bar */}
        <div
          className="glass-panel"
          style={{
            padding: '0.65rem 1rem',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--border-subtle)',
            background: 'rgba(15, 23, 42, 0.85)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            flexShrink: 0,
          }}
        >
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about your knowledge cards (Press Enter to send)..."
            rows={1}
            disabled={loading}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-main)',
              fontSize: '0.92rem',
              lineHeight: 1.5,
              resize: 'none',
              maxHeight: '120px',
              fontFamily: 'inherit',
            }}
          />

          <button
            onClick={handleSend}
            disabled={!inputText.trim() || loading}
            className="btn btn-primary"
            style={{
              padding: '0.6rem 1rem',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
            }}
          >
            {loading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
            <span>Ask</span>
          </button>
        </div>
      </main>

      {/* Card Detail Modal for Clicked Citations */}
      <CardDetailModal
        card={selectedCardForDetail}
        isOpen={selectedCardForDetail !== null}
        onClose={() => setSelectedCardForDetail(null)}
        onEdit={() => {}}
        onDelete={() => setSelectedCardForDetail(null)}
      />
    </div>
  );
};
