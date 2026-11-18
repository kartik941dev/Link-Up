import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import {
  Layers,
  Network,
  LayoutGrid,
  Sparkles,
  LogOut,
  ChevronDown,
  Mail,
  Copy,
  Check,
  Calendar,
  ShieldCheck,
  Edit2,
  X,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout, updateProfile } = useAuth();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const displayName = user?.name || user?.username || (user?.email ? user.email.split('@')[0] : 'User');
  const userInitial = displayName.charAt(0).toUpperCase();

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileOpen(false);
      }
    };

    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileOpen]);

  const handleCopyEmail = async () => {
    if (!user?.email) return;
    try {
      await navigator.clipboard.writeText(user.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      setEditError('Name cannot be empty.');
      return;
    }
    try {
      setIsSavingName(true);
      setEditError(null);
      await updateProfile({ name: newName.trim() });
      setIsEditingName(false);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update name');
    } finally {
      setIsSavingName(false);
    }
  };

  const formattedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const navLinks = [
    { name: 'Canvas', path: '/', icon: <Layers size={17} /> },
    { name: 'Knowledge Graph', path: '/graph', icon: <Network size={17} /> },
    { name: 'Smart Arrange', path: '/arrange', icon: <LayoutGrid size={17} /> },
    { name: 'AI Assistant', path: '/chat', icon: <Sparkles size={17} /> },
  ];

  return (
    <header className="app-header">
      <div className="header-container">
        {/* Brand */}
        <Link to="/" className="brand-logo">
          <div className="brand-icon">
            <Layers size={20} />
          </div>
          <span>LinkUp</span>
        </Link>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.5rem 0.9rem',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  background: isActive ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                  border: isActive
                    ? '1px solid rgba(99, 102, 241, 0.4)'
                    : '1px solid transparent',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {link.icon}
                <span>{link.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info & Interactive Profile Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }} ref={profileRef}>
          {/* Profile Pill Trigger showing ONLY Username */}
          <button
            onClick={() => setIsProfileOpen((prev) => !prev)}
            aria-expanded={isProfileOpen}
            aria-haspopup="true"
            title="Click to view account details"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              padding: '0.35rem 0.75rem 0.35rem 0.45rem',
              borderRadius: 'var(--radius-full)',
              background: isProfileOpen ? 'rgba(99, 102, 241, 0.18)' : 'rgba(255, 255, 255, 0.05)',
              border: isProfileOpen ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid var(--border-subtle)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              outline: 'none',
            }}
          >
            {/* User Avatar Circle */}
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.75rem',
                boxShadow: '0 2px 4px rgba(99, 102, 241, 0.3)',
              }}
            >
              {userInitial}
            </div>

            {/* ONLY Name / Username displayed on Dashboard */}
            <span
              style={{
                maxWidth: '140px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 600,
                fontSize: '0.825rem',
                color: isProfileOpen ? '#ffffff' : 'var(--text-main)',
              }}
            >
              {displayName}
            </span>

            <ChevronDown
              size={13}
              style={{
                color: 'var(--text-dim)',
                transform: isProfileOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform var(--transition-fast)',
              }}
            />
          </button>

          {/* Quick Sign Out Button */}
          <button
            onClick={logout}
            className="btn btn-secondary"
            style={{
              padding: '0.45rem 0.75rem',
              fontSize: '0.825rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            title="Sign out of LinkUp"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>

          {/* Profile Dropdown Popover */}
          {isProfileOpen && (
            <div
              className="animate-fade-in"
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: '300px',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(15, 23, 42, 0.96)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.65), 0 0 1px 1px rgba(99, 102, 241, 0.15)',
                zIndex: 1000,
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              {/* Header with Avatar and Username */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.25rem',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                    flexShrink: 0,
                  }}
                >
                  {userInitial}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {isEditingName ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <input
                          type="text"
                          className="input-field"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Enter your name"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.825rem', flex: 1 }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveName();
                            if (e.key === 'Escape') setIsEditingName(false);
                          }}
                        />
                        <button
                          onClick={handleSaveName}
                          disabled={isSavingName}
                          className="btn btn-primary"
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                          title="Save"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => setIsEditingName(false)}
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                          title="Cancel"
                        >
                          <X size={13} />
                        </button>
                      </div>
                      {editError && (
                        <span style={{ fontSize: '0.7rem', color: '#f87171' }}>{editError}</span>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', justifyContent: 'space-between' }}>
                        <div
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            color: '#ffffff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {displayName}
                        </div>
                        <button
                          onClick={() => {
                            setIsEditingName(true);
                            setNewName(user?.name || user?.username || '');
                            setEditError(null);
                          }}
                          title="Edit your display name"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-dim)',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                      {user?.username && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '1px' }}>
                          @{user.username}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '3px' }}>
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>
                      Active Workspace
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

              {/* Email Address Section with Copy Option */}
              <div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-dim)',
                    display: 'block',
                    marginBottom: '0.35rem',
                  }}
                >
                  Email Address
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.65rem',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    gap: '0.5rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      minWidth: 0,
                      color: 'var(--text-main)',
                      fontSize: '0.8rem',
                    }}
                  >
                    <Mail size={13} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontFamily: 'monospace',
                      }}
                    >
                      {user?.email || 'Not specified'}
                    </span>
                  </div>

                  <button
                    onClick={handleCopyEmail}
                    title="Copy email to clipboard"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: copiedEmail ? '#10b981' : 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'color var(--transition-fast)',
                    }}
                  >
                    {copiedEmail ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {/* Account Details */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                }}
              >
                {formattedDate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Calendar size={13} style={{ color: 'var(--text-dim)' }} />
                    <span>Member since {formattedDate}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <ShieldCheck size={13} style={{ color: '#6366f1' }} />
                  <span>Verified Account Session</span>
                </div>
              </div>

              <div style={{ height: '1px', background: 'var(--border-subtle)' }} />

              {/* Sign Out Action */}
              <button
                onClick={() => {
                  setIsProfileOpen(false);
                  logout();
                }}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '0.55rem',
                  fontSize: '0.825rem',
                  color: '#f87171',
                  borderColor: 'rgba(239, 68, 68, 0.25)',
                  background: 'rgba(239, 68, 68, 0.06)',
                }}
              >
                <LogOut size={14} />
                <span>Sign Out of Account</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
