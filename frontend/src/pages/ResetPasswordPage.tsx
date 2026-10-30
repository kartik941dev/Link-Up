import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Layers, Lock, ArrowRight, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { api, getErrorMessage } from '../utils/api.js';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!token) {
      setErrorMessage('Reset token is missing. Please click the link directly from your email.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/auth/reset-password', {
        token,
        newPassword,
      });
      setIsSuccess(true);
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card animate-fade-in" style={{ textAlign: 'center' }}>
          <div
            className="brand-icon"
            style={{ width: '48px', height: '48px', margin: '0 auto 1.5rem auto', borderRadius: 'var(--radius-lg)' }}
          >
            <Layers size={26} />
          </div>
          <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>
            <AlertCircle size={16} />
            <span>Missing reset token. Please use the exact link sent to your email.</span>
          </div>
          <Link to="/forgot-password" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            Request New Reset Link
          </Link>
        </div>
      </div>
    );
  }

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
          <h1>Create New Password</h1>
          <p>Please enter your new password below</p>
        </div>

        {errorMessage && (
          <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {isSuccess ? (
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
            <h3 style={{ color: 'var(--text-main)', fontSize: '1.2rem', marginBottom: '0.5rem' }}>
              Password Reset Complete!
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.75rem' }}>
              Your password has been successfully updated. You can now sign in to LinkUp using your new credentials.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/login', { replace: true })}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Proceed to Sign In
              <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="input-label" htmlFor="newPassword">
                New Password (min. 8 characters)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="newPassword"
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
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

            <div className="input-group" style={{ marginBottom: '1.75rem' }}>
              <label className="input-label" htmlFor="confirmPassword">
                Confirm New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="confirmPassword"
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
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
              disabled={isSubmitting}
              style={{ width: '100%', justifyContent: 'center', marginBottom: '1.5rem' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Updating Password...
                </>
              ) : (
                <>
                  Reset Password
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
