/**
 * AuthModal Component (React / JSX)
 * Authentication modal supporting Supabase Facebook & Google OAuth,
 * Email Registration (with Password confirmation & Passenger Category),
 * and Login with scrollbar-free sleek styling.
 */
import React, { useState } from 'react';
import { User, Mail, ArrowRight } from 'lucide-react';
import {
  loginWithGoogle,
  loginWithFacebook,
  signUpWithEmail,
  loginWithEmail
} from '../services/supabaseClient';

export function AuthModal({ isOpen, onClose, onLoginSuccess, onLoginFailure }) {
  const [tab, setTab] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [category, setCategory] = useState('Regular');
  const setErrorMsg = (message) => {
    if (message && tab === 'login') onLoginFailure?.(message);
  };
  const [isLoading, setIsLoading] = useState(false);



  if (!isOpen) return null;



  // Handle Facebook OAuth direct login via Supabase
  const handleFacebookLogin = async () => {
    setIsLoading(true);
    setErrorMsg('');
    const res = await loginWithFacebook();
    if (!res.success && res.error) {
      setIsLoading(false);
      setErrorMsg(res.error);
    }
  };

  // Handle Google OAuth direct login via Supabase
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg('');
    const res = await loginWithGoogle();
    if (!res.success && res.error) {
      setIsLoading(false);
      setErrorMsg(res.error);
    }
  };

  // Handle Form Submit (Log In or Create Account via Supabase)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (tab === 'signup') {
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match. Please re-enter your password.');
        return;
      }
      setIsLoading(true);
      const res = await signUpWithEmail(email, password, name, category);
      setIsLoading(false);
      if (res.success && res.session) {
        onLoginSuccess(res.user);
        onClose();
      } else if (res.success && res.needsEmailConfirmation) {
        setErrorMsg('Account created. Please confirm your email via the link we sent, then log in.');
        setTab('login');
      } else {
        setErrorMsg(res.error || 'Failed to create account.');
      }
    } else {
      setIsLoading(true);
      const res = await loginWithEmail(email, password);
      setIsLoading(false);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to log in.');
      }
    }
  };

  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        style={{
          maxWidth: '440px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          overflowY: 'auto'
        }}
      >
        {/* Header Icon & Title */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            display: 'inline-flex',
            padding: '0.75rem',
            borderRadius: '50%',
            backgroundColor: 'var(--primary-light)',
            color: 'var(--primary)',
            marginBottom: '0.5rem'
          }}>
            <User size={28} />
          </div>
          <h2 style={{ fontSize: '1.35rem' }}>QCBus Passenger Access</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Access exclusive QC Bus information by logging in or signing up here
          </p>
        </div>

        {/* Social Authentication Buttons (Supabase Facebook & Google) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={handleFacebookLogin}
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: '#1877f2',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem',
                  boxShadow: '0 2px 6px rgba(24, 119, 242, 0.3)'
                }}
              >
                <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>f</span> Continue with Facebook
              </button>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="btn-secondary"
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  fontSize: '0.88rem',
                  justifyContent: 'center',
                  gap: '0.6rem'
                }}
              >
                <Mail size={16} style={{ color: '#ea4335' }} /> Continue with Google
              </button>
            </div>

            {/* Divider */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.25rem',
              color: 'var(--text-muted)',
              fontSize: '0.78rem'
            }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
              <span>OR WITH EMAIL ACCOUNT</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }} />
            </div>

            {/* Tab switcher */}
            <div style={{
              display: 'flex',
              backgroundColor: 'var(--bg-subtle)',
              padding: '0.25rem',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1.25rem'
            }}>
              <button
                type="button"
                onClick={() => { setTab('login'); setErrorMsg(''); }}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  backgroundColor: tab === 'login' ? 'var(--bg-card)' : 'transparent',
                  color: tab === 'login' ? 'var(--primary)' : 'var(--text-secondary)',
                  boxShadow: tab === 'login' ? 'var(--shadow-sm)' : 'none'
                }}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => { setTab('signup'); setErrorMsg(''); }}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  backgroundColor: tab === 'signup' ? 'var(--bg-card)' : 'transparent',
                  color: tab === 'signup' ? 'var(--primary)' : 'var(--text-secondary)',
                  boxShadow: tab === 'signup' ? 'var(--shadow-sm)' : 'none'
                }}
              >
                Create Account
              </button>
            </div>

            {/* Auth Form */}
            <form onSubmit={handleSubmit}>
              {tab === 'signup' && (
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Email or Mobile Number</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {/* Confirm Password - Prompted only during Create Account */}
              {tab === 'signup' && (
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Passenger Category - Visible ONLY during Create Account */}
              {tab === 'signup' && (
                <div className="form-group">
                  <label className="form-label">Passenger Category</label>
                  <select
                    className="form-select"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="Regular">Regular Passenger</option>
                    <option value="Senior Citizen">Senior Citizen (Priority Seat Access)</option>
                    <option value="PWD">Person with Disability / PWD</option>
                    <option value="Pregnant">Pregnant</option>
                  </select>
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={isLoading} style={{ width: '100%', marginTop: '0.5rem' }}>
                {isLoading ? 'Processing...' : tab === 'login' ? 'Log In & Continue' : 'Register Account'} <ArrowRight size={18} />
              </button>
            </form>


        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: '1.25rem',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
            border: 'none',
            background: 'none',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
