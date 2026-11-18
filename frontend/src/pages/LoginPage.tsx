import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Layers, User, Mail, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName && !trimmedEmail) {
      setFormError('Please enter your Name/Username or Email address.');
      return;
    }

    if (!password) {
      setFormError('Please enter your password.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login({
        name: trimmedName,
        username: trimmedName,
        email: trimmedEmail,
        password,
      });
      navigate(from, { replace: true });
    } catch (err: any) {
      setFormError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card animate-fade-in">
        <div className="auth-header">
          <div
            className="brand-icon"
            style={{ width: '48px', height: '48px', margin: '0 auto', borderRadius: 'var(--radius-lg)' }}
          >
            <Layers size={26} />
          </div>
          <h1>Welcome to LinkUp</h1>
          <p>Sign in to your intelligent knowledge workspace</p>
        </div>

        {formError && (
          <div className="alert alert-error">
            <AlertCircle size={16} />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Name / Username Field */}
          <div className="input-group">
            <label className="input-label" htmlFor="name">
              Name or Username
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="name"
                type="text"
                className="input-field"
                placeholder="e.g. kartik or Kartik Patel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                style={{ paddingLeft: '2.5rem' }}
              />
              <User
                size={17}
                style={{
                  position: 'absolute',
                  left: '0.85rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-dim)',
                }}
              />
            </div>
          </div>

          {/* Email Address Field */}
          <div className="input-group">
            <label className="input-label" htmlFor="email">
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="email"
                type="email"
                className="input-field"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                style={{ paddingLeft: '2.5rem' }}
              />
              <Mail
                size={17}
                style={{
                  position: 'absolute',
                  left: '0.85rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-dim)',
                }}
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="input-group" style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="input-label" htmlFor="password">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="auth-link"
                style={{ fontSize: '0.8rem', textDecoration: 'none' }}
              >
                Forgot password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                style={{ paddingLeft: '2.5rem' }}
              />
              <Lock
                size={17}
                style={{
                  position: 'absolute',
                  left: '0.85rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-dim)',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '0.85rem' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>

        <div
          style={{
            marginTop: '1.75rem',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: 'var(--text-muted)',
          }}
        >
          Don&apos;t have an account yet?{' '}
          <Link
            to="/signup"
            style={{
              color: 'var(--accent-secondary)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
};
