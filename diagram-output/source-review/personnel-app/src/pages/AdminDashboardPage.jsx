import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Bus, RefreshCw, ShieldCheck, UserRound, Users } from 'lucide-react';
import {
  fetchOperationsPersonnel,
  setOperationsPersonnelActive
} from '../services/supabaseClient';

export function AdminDashboardPage() {
  const [personnel, setPersonnel] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const personnelResult = await fetchOperationsPersonnel();
    if (personnelResult.success) setPersonnel(personnelResult.data);
    else setError(personnelResult.error);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const counts = useMemo(() => ({
    driver: personnel.filter((person) => person.personnel_type === 'driver').length,
    conductor: personnel.filter((person) => person.personnel_type === 'conductor').length,
    dispatcher: personnel.filter((person) => person.personnel_type === 'dispatcher').length,
    active: personnel.filter((person) => person.is_active).length
  }), [personnel]);

  const visiblePersonnel = useMemo(() => (
    filter === 'all' ? personnel : personnel.filter((person) => person.personnel_type === filter)
  ), [filter, personnel]);

  const handleTogglePersonnel = async (person) => {
    setBusy(true); setError(''); setMessage('');
    const result = await setOperationsPersonnelActive(person.id, !person.is_active);
    if (result.success) {
      setMessage(`${person.full_name} is now ${person.is_active ? 'inactive' : 'active'}.`);
      await refresh();
    } else setError(result.error);
    setBusy(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      <header className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', background: '#0f2a3a' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', color: '#22d3ee' }}><ShieldCheck size={22} /><span style={{ fontSize: '.78rem', fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>Administration</span></div>
          <h1 style={{ margin: '.55rem 0 .25rem', fontSize: '1.7rem' }}>Registered Personnel</h1>
          <p style={{ margin: 0, color: '#94a3b8' }}>View the drivers, conductors, and dispatchers available for bus duty.</p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={refresh} disabled={loading} style={{ display: 'inline-flex', gap: '.45rem', alignItems: 'center' }}><RefreshCw size={16} /> Refresh</button>
      </header>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {message && <div className="alert alert-success" role="status">{message}</div>}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '.85rem' }}>
        {[
          { title: 'Drivers', count: counts.driver, icon: Bus, color: '#38bdf8' },
          { title: 'Conductors', count: counts.conductor, icon: UserRound, color: '#a78bfa' },
          { title: 'Dispatchers', count: counts.dispatcher, icon: Users, color: '#34d399' }
        ].map(({ title, count, icon: Icon, color }) => (
          <div className="card" key={title} style={{ padding: '1rem 1.1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color }}><span style={{ fontSize: '.8rem', color: '#94a3b8' }}>{title}</span><Icon size={19} /></div>
            <div style={{ fontSize: '1.7rem', fontWeight: 800, marginTop: '.45rem' }}>{count}</div>
          </div>
        ))}
      </section>

      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.8rem', flexWrap: 'wrap', marginBottom: '.85rem' }}>
          <div><h2 style={{ fontSize: '1.15rem', margin: 0, display: 'flex', alignItems: 'center', gap: '.45rem' }}><BadgeCheck size={19} color="#34d399" /> Registered Personnel</h2><p style={{ color: '#94a3b8', margin: '.35rem 0 0', fontSize: '.85rem' }}>{counts.active} active of {personnel.length} registered</p></div>
          <select aria-label="Filter personnel type" className="form-select" value={filter} onChange={(event) => setFilter(event.target.value)} style={{ width: 'auto', minWidth: '160px' }}>
            <option value="all">All personnel</option><option value="driver">Drivers</option><option value="conductor">Conductors</option><option value="dispatcher">Dispatchers</option>
          </select>
        </div>
        <div className="table-container" style={{ marginBottom: 0 }}>
          <table className="data-table">
            <thead><tr><th>Personnel type</th><th>Name</th><th>Personnel ID</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {visiblePersonnel.map((person) => <tr key={person.id}>
                <td style={{ textTransform: 'capitalize' }}>{person.personnel_type}</td><td>{person.full_name}</td><td><strong>{person.personnel_id}</strong></td>
                <td><span style={{ color: person.is_active ? '#34d399' : '#94a3b8' }}>{person.is_active ? 'Active' : 'Inactive'}</span></td>
                <td><button className="btn btn-secondary" type="button" disabled={busy} onClick={() => handleTogglePersonnel(person)}>{person.is_active ? 'Deactivate' : 'Reactivate'}</button></td>
              </tr>)}
              {!loading && visiblePersonnel.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8' }}>{personnel.length ? 'No personnel match this filter.' : 'No personnel have been registered yet.'}</td></tr>}
              {loading && <tr><td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8' }}>Loading personnel register…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
