import React, { useCallback, useEffect, useState } from 'react';
import { Check, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { fetchAdminSignupRequests, reviewAdminSignupRequest } from '../services/supabaseClient';

export function AdminSignupRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    const result = await fetchAdminSignupRequests();
    if (result.success) setRequests(result.data);
    else setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const decide = async (request, approve) => {
    setBusy(true); setError(''); setMessage('');
    const result = await reviewAdminSignupRequest({ requestId: request.id, userId: request.user_id, approve });
    if (result.success) {
      setMessage(approve ? 'Administrator access approved.' : 'Administrator signup request declined.');
      await refresh();
    } else setError(result.error);
    setBusy(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <header className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div><h1 style={{ margin: 0, fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '.55rem' }}><ShieldCheck color="#a78bfa" /> Admin Signup Requests</h1><p style={{ margin: '.5rem 0 0', color: '#94a3b8' }}>Review new administrator accounts and grant access only to authorized admins.</p></div>
        <button className="btn btn-secondary" type="button" onClick={refresh} disabled={loading}><RefreshCw size={16} /> Refresh</button>
      </header>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {message && <div className="alert alert-success" role="status">{message}</div>}
      <section className="card">
        {loading && requests.length === 0 ? <p style={{ color: '#94a3b8', margin: 0 }}>Loading administrator requests…</p> : requests.length === 0 ? <p style={{ color: '#94a3b8', margin: 0 }}>There are no pending administrator requests.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.7rem' }}>
            {requests.map((request) => <article key={request.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', padding: '.9rem', border: '1px solid var(--border-color)', borderRadius: '9px', background: 'rgba(15,23,42,.45)' }}>
              <div><strong>{request.profile?.full_name || 'New administrator'}</strong><div style={{ color: '#94a3b8', fontSize: '.85rem' }}>{request.profile?.email || 'Email unavailable'} · Requested {new Date(request.requested_at).toLocaleDateString()}</div></div>
              <div style={{ display: 'flex', gap: '.5rem' }}><button className="btn btn-primary" type="button" disabled={busy} onClick={() => decide(request, true)}><Check size={15} /> Approve</button><button className="btn btn-secondary" type="button" disabled={busy} onClick={() => decide(request, false)}><X size={15} /> Decline</button></div>
            </article>)}
          </div>
        )}
      </section>
    </div>
  );
}
