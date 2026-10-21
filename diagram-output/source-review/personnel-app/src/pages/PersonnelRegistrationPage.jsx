import React, { useState } from 'react';
import { Plus, UserRoundPlus } from 'lucide-react';
import { createOperationsPersonnel } from '../services/supabaseClient';

export function PersonnelRegistrationPage() {
  const [personnelType, setPersonnelType] = useState('driver');
  const [personnelId, setPersonnelId] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const result = await createOperationsPersonnel({ personnelType, personnelId, fullName });
    if (result.success) {
      setMessage(`${fullName.trim()} was added to the active personnel register.`);
      setPersonnelId(''); setFullName('');
    } else setError(result.error);
    setBusy(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <header className="card">
        <h1 style={{ margin: 0, fontSize: '1.6rem', display: 'flex', gap: '.55rem', alignItems: 'center' }}><UserRoundPlus color="#22d3ee" /> Register Bus Personnel</h1>
        <p style={{ margin: '.5rem 0 0', color: '#94a3b8' }}>Add a verified driver, conductor, or dispatcher to the active duty register.</p>
      </header>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {message && <div className="alert alert-success" role="status">{message}</div>}
      <section className="card" style={{ maxWidth: '760px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="personnel-type" className="form-label">Personnel type</label>
            <select id="personnel-type" className="form-select" value={personnelType} onChange={(event) => setPersonnelType(event.target.value)}>
              <option value="driver">Driver</option><option value="conductor">Conductor</option><option value="dispatcher">Dispatcher</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="personnel-id" className="form-label">Personnel ID</label>
            <input id="personnel-id" className="form-input" maxLength={80} value={personnelId} onChange={(event) => setPersonnelId(event.target.value)} placeholder="e.g. DRV-1024" required />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="personnel-name" className="form-label">Full name</label>
            <input id="personnel-name" className="form-input" maxLength={160} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Personnel full name" required />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy} style={{ justifyContent: 'center', minHeight: '42px' }}><Plus size={16} /> {busy ? 'Adding…' : 'Add to register'}</button>
        </form>
      </section>
    </div>
  );
}
