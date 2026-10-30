import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Mail, ArrowLeft, ArrowRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { api, getErrorMessage } from '../utils/api.js';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/auth/forgot-password', { email: email.trim() });
      setIsSubmitted(true);
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err));
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
          <h1>Reset Password</h1>
          <p>We'll send you a secure link to reset your account password</p>
        </div>

        {errorMessage && (
          <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {isSubmitted ? (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'rgba(34, 197, 94, 0.12)',
                color: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem auto',
                border: '1px solid rgba(34, 197, 94, 0.25)',
              }}
            >
              <CheckCircle2 size={30} />
            </div>
            <h3 style={{ color: 'var(--text-main)', fontSize: '1.15rem', marginBottom: '0.5rem' }}>
              Check your inbox
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.75rem' }}>
              If an account is associated with <strong>{email}</strong>, you will receive an email shortly with a password reset link (valid for 15 minutes).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsSubmitted(false);
                  setEmail('');
                }}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Send to a different email
              </button>
              <Link
                to="/login"
                className="btn btn-ghost"
                style={{ width: '100%', justifyContent: 'center', gap: '0.5rem' }}
              >
                <ArrowLeft size={16} />
                Back to Sign in
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="input-group" style={{ marginBottom: '1.75rem' }}>
              <label className="input-label" htmlFor="email">
                Your Account Email
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
                  required
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

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ width: '100%', justifyContent: 'center', marginBottom: '1.5rem' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Sending link...
                </>
              ) : (
                <>
                  Send Reset Link
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div style={{ textAlign: 'center' }}>
              <Link
                to="/login"
                className="auth-link"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}
              >
                <ArrowLeft size={15} />
                Back to Sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
