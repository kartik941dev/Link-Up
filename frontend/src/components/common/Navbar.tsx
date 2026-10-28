import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { Layers, Network, LayoutGrid, Sparkles, LogOut, User as UserIcon } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

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

        {/* User Info & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.825rem',
              color: 'var(--text-muted)',
            }}
          >
            <UserIcon size={14} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </span>
          </div>

          <button
            onClick={logout}
            className="btn btn-secondary"
            style={{
              padding: '0.45rem 0.85rem',
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
        </div>
      </div>
    </header>
  );
};
