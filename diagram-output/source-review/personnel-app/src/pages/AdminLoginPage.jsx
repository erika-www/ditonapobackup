import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { loginAdmin, signUpAdminRequest } from '../services/supabaseClient';

export function AdminLoginPage() {
  const [tab, setTab] = useState('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const auth = useAuth() || {};
  const { loginAdminAccount, isAuthenticated, user } = auth;
  const navigate = useNavigate();
  const location = useLocation();

  // If coming specifically to unlock personnel duty check-in, return to /login.
  // Otherwise (intent is accessing admin exclusive portal), return to /admin.
  const isPersonnelValidation = location.state?.target === 'personnel';
  const returnTo = isPersonnelValidation ? '/login' : '/admin';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      if (tab === 'signup') {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        const result = await signUpAdminRequest({ fullName, email, password });
        if (!result.success) throw new Error(result.error);
        setNotice('Your admin account request has been submitted. An existing administrator must approve access. Check your email if confirmation is required.');
        setTab('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        if (typeof loginAdminAccount === 'function') {
          await loginAdminAccount(email, password);
        } else {
          const directLoginResult = await loginAdmin(email, password);
          if (!directLoginResult.success) {
            throw new Error(directLoginResult.error || 'Administrator access could not be completed.');
          }
        }
        navigate(returnTo, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Administrator access could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  const tabStyle = (selected) => ({
    flex: 1, padding: '.65rem', borderRadius: '8px', cursor: 'pointer',
    border: `1px solid ${selected ? '#06b6d4' : 'var(--border-color)'}`,
    background: selected ? 'rgba(6,182,212,.14)' : 'transparent',
    color: selected ? '#22d3ee' : '#94a3b8', fontWeight: 700
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-dark)', padding: '1.5rem' }}>
      <div className="modal-content" style={{ maxWidth: '480px', padding: '2.25rem', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.35rem' }}>
          <ShieldCheck size={44} color="#06b6d4" style={{ margin: '0 auto .5rem' }} />
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, marginBottom: '.25rem' }}>Administrator Access</h1>
          <p style={{ color: '#94a3b8', fontSize: '.88rem', margin: 0 }}>QC Bus Operations Portal</p>
        </div>

        {isAuthenticated && (
          <div style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '10px', padding: '1rem', marginBottom: '1.25rem', textAlign: 'center' }}>
            <div style={{ color: '#22d3ee', fontWeight: 700, fontSize: '.95rem', marginBottom: '.35rem' }}>
              ✓ Administrator Session Authorized
            </div>
            <p style={{ color: '#94a3b8', fontSize: '.82rem', marginBottom: '.85rem' }}>
              Logged in as <strong style={{ color: '#f8fafc' }}>{user?.username || 'Administrator'}</strong>. You can proceed directly to the Admin Exclusive portal or return to the bus duty terminal.
            </p>
            <div style={{ display: 'flex', gap: '.65rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => navigate('/admin', { replace: true })}
                className="btn btn-primary"
                style={{ padding: '.55rem 1rem', fontSize: '.88rem', fontWeight: 700 }}
              >
                Enter Admin Portal →
              </button>
              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                className="btn btn-secondary"
                style={{ padding: '.55rem 1rem', fontSize: '.88rem', fontWeight: 600 }}
              >
                Back to Bus Duty Check-in
              </button>
            </div>
            <div style={{ marginTop: '.85rem', fontSize: '.78rem', color: '#64748b' }}>
              Or sign in with another administrator account below:
            </div>
          </div>
        )}

        {error && <div className="alert alert-danger" style={{ marginBottom: '1rem', padding: '.75rem 1rem', fontSize: '.85rem' }}>{error}</div>}
        {notice && <div className="alert alert-success" style={{ marginBottom: '1rem', padding: '.75rem 1rem', fontSize: '.85rem' }}>{notice}</div>}

        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
          <button type="button" style={tabStyle(tab === 'login')} onClick={() => { setTab('login'); setError(''); }}>Log in</button>
          <button type="button" style={tabStyle(tab === 'signup')} onClick={() => { setTab('signup'); setError(''); }}>Sign up</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
          {tab === 'signup' && <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} required /></div>}
          <div className="form-group">
            <label className="form-label"><Mail size={14} style={{ verticalAlign: 'middle', marginRight: '.3rem' }} />Email</label>
            <input type="email" className="form-input" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label"><LockKeyhole size={14} style={{ verticalAlign: 'middle', marginRight: '.3rem' }} />Password</label>
            <input type="password" className="form-input" autoComplete={tab === 'login' ? 'current-password' : 'new-password'} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          {tab === 'signup' && <div className="form-group"><label className="form-label">Confirm Password</label><input type="password" className="form-input" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></div>}
          {tab === 'signup' && <p style={{ color: '#94a3b8', fontSize: '.82rem', margin: 0 }}>New accounts remain pending until an existing administrator approves them.</p>}
          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ justifyContent: 'center', padding: '.8rem', fontWeight: 700 }}>
            {submitting ? 'Please wait...' : tab === 'login' ? 'Log in' : 'Request Admin Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          <Link to="/login" style={{ color: '#06b6d4', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '.35rem' }}>
            <ArrowLeft size={15} /> Back to bus duty login
          </Link>
        </div>
      </div>
    </div>
  );
}
