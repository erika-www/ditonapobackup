import React, { useCallback, useEffect, useState } from 'react';
import { Check, Clock3, RefreshCw, X } from 'lucide-react';
import { fetchOperationsPersonnelRequests, reviewOperationsPersonnelRequest } from '../services/supabaseClient';

export function PersonnelRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    const result = await fetchOperationsPersonnelRequests();
    if (result.success) setRequests(result.data);
    else setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const decide = async (request, approve) => {
    setBusy(true); setError(''); setMessage('');
    const result = await reviewOperationsPersonnelRequest({ requestId: request.id, approve });
    if (result.success) {
      setMessage(approve ? `${request.full_name} was added to the personnel register.` : 'Personnel request declined.');
      await refresh();
    } else setError(result.error);
    setBusy(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <header className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div><h1 style={{ margin: 0, fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '.55rem' }}><Clock3 color="#fbbf24" /> Personnel Requests</h1><p style={{ margin: '.5rem 0 0', color: '#94a3b8' }}>Verify the requested name, role, and ID before approving it for bus duty.</p></div>
        <button className="btn btn-secondary" type="button" onClick={refresh} disabled={loading}><RefreshCw size={16} /> Refresh</button>
      </header>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {message && <div className="alert alert-success" role="status">{message}</div>}
      <section className="card">
        {loading && requests.length === 0 ? <p style={{ color: '#94a3b8', margin: 0 }}>Loading personnel requests…</p> : requests.length === 0 ? <p style={{ color: '#94a3b8', margin: 0 }}>There are no pending personnel requests.</p> : (
          <div className="table-container" style={{ marginBottom: 0 }}><table className="data-table">
            <thead><tr><th>Type</th><th>Full name</th><th>Personnel ID</th><th>Requested</th><th>Review</th></tr></thead>
            <tbody>{requests.map((request) => <tr key={request.id}>
              <td style={{ textTransform: 'capitalize' }}>{request.personnel_type}</td><td>{request.full_name}</td><td><strong>{request.personnel_id}</strong></td><td>{new Date(request.requested_at).toLocaleDateString()}</td>
              <td><div style={{ display: 'flex', gap: '.45rem' }}><button className="btn btn-primary" type="button" disabled={busy} onClick={() => decide(request, true)}><Check size={15} /> Approve</button><button className="btn btn-secondary" type="button" disabled={busy} onClick={() => decide(request, false)}><X size={15} /> Decline</button></div></td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
