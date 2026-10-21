import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { submitOperationsPersonnelRequest } from '../services/supabaseClient';

export function PersonnelRequestPage() {
  const [personnelType, setPersonnelType] = useState('driver');
  const [personnelId, setPersonnelId] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(''); setBusy(true);
    const result = await submitOperationsPersonnelRequest({ personnelType, personnelId, fullName });
    if (result.success) setSubmitted(true);
    else setError(result.error);
    setBusy(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', backgroundColor: 'var(--bg-dark)', padding: '1.25rem' }}>
      <div className="modal-content" style={{ width: '100%', maxWidth: '520px', padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.35rem' }}>
          <ShieldCheck size={42} color="#06b6d4" style={{ margin: '0 auto .5rem' }} />
          <h1 style={{ fontSize: '1.55rem', margin: 0 }}>Personnel Registration Request</h1>
          <p style={{ color: '#94a3b8', marginBottom: 0 }}>An administrator will verify your details before adding you to the bus duty register.</p>
        </div>

        {submitted ? (
          <div role="status" className="alert alert-success" style={{ padding: '1rem', lineHeight: 1.55 }}>
            <ClipboardCheck size={18} style={{ verticalAlign: 'middle', marginRight: '.4rem' }} />
            Your request was submitted for review. It will become available in the duty registration form after an administrator approves it.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '.8rem' }}>
            {error && <div role="alert" className="alert alert-danger">{error}</div>}
            <div className="form-group">
              <label className="form-label" htmlFor="request-type">Personnel type</label>
              <select id="request-type" className="form-select" value={personnelType} onChange={(event) => setPersonnelType(event.target.value)}>
                <option value="driver">Driver</option><option value="conductor">Conductor</option><option value="dispatcher">Dispatcher</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="request-name">Full name</label>
              <input id="request-name" className="form-input" autoComplete="name" maxLength={160} value={fullName} onChange={(event) => setFullName(event.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="request-id">Personnel ID</label>
              <input id="request-id" className="form-input" maxLength={80} placeholder="e.g. DRV-1024" value={personnelId} onChange={(event) => setPersonnelId(event.target.value)} required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy} style={{ justifyContent: 'center', padding: '.8rem', fontWeight: 700 }}>{busy ? 'Submitting…' : 'Submit for approval'}</button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: '1.1rem' }}>
          <Link to="/login" style={{ color: '#06b6d4', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '.35rem' }}><ArrowLeft size={15} /> Back to duty registration</Link>
        </div>
      </div>
    </div>
  );
}
