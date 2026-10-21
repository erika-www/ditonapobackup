import React, { useCallback, useEffect, useState } from 'react';
import { MapPin, Plus, X } from 'lucide-react';
import { addConfiguredRoute4Stop, fetchConfiguredRoute4Stops } from '../services/supabaseClient';
import { applyRoute4CoordinateOverrides, saveRoute4CoordinateOverride } from '@shared/route4Stops';

const emptyForm = { name: '', latitude: '', longitude: '' };

export function StopsAdminPage() {
  const [stops, setStops] = useState([]);
  const [form, setForm] = useState({ ...emptyForm, direction: 'Northbound' });
  const [editingStop, setEditingStop] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadStops = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await fetchConfiguredRoute4Stops({ seedIfEmpty: true });
    if (result.success) {
      const north = new Map(applyRoute4CoordinateOverrides(result.data, 'Northbound').map((stop) => [stop.id, stop]));
      const south = new Map(applyRoute4CoordinateOverrides(result.data, 'Southbound').map((stop) => [stop.id, stop]));
      setStops(result.data.map((stop) => ({ ...stop, northbound: north.get(stop.id), southbound: south.get(stop.id) })));
    }
    else setError(result.error || 'Could not load Route 4 stops.');
    setLoading(false);
  }, []);

  useEffect(() => { loadStops(); }, [loadStops]);

  const openAdd = () => {
    setForm(emptyForm);
    setEditingStop(null);
    setShowAddForm(true);
  };

  const openEdit = (stop, direction = 'Northbound') => {
    const selected = direction === 'Southbound' ? stop.southbound : stop.northbound;
    setForm({ name: stop.name, latitude: String(selected?.lat ?? stop.lat), longitude: String(selected?.lng ?? stop.lng), direction });
    setEditingStop(stop);
    setShowAddForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!form.name.trim() || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setError('Enter a stop name and valid latitude/longitude coordinates.');
      setSaving(false);
      return;
    }
    if (editingStop) {
      saveRoute4CoordinateOverride(editingStop.id, form.direction, latitude, longitude);
      setNotice(`${form.direction} coordinates saved for this test browser.`);
      setShowAddForm(false);
      await loadStops();
      setSaving(false);
      return;
    }
    const result = await addConfiguredRoute4Stop({ name: form.name, latitude, longitude });
    if (!result.success) {
      setError(result.error || 'Could not save the route stop.');
    } else {
      setNotice(editingStop ? 'Route stop updated.' : 'Route stop added to Route 4.');
      setShowAddForm(false);
      await loadStops();
    }
    setSaving(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <header className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.7rem', margin: 0, display: 'flex', alignItems: 'center', gap: '.5rem' }}><MapPin color="#34d399" /> Route Stop List & Location Coordinates Configuration</h1>
          <p style={{ color: '#94a3b8', margin: '.45rem 0 0' }}>These Route 4 stops are shared with the driver route view and passenger boarding and destination choices.</p>
        </div>
        <button type="button" onClick={openAdd} className="btn btn-primary"><Plus size={16} /> Add New Route Stop</button>
      </header>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      <section className="card">
        <div className="table-container" style={{ marginBottom: 0 }}>
          <table className="data-table">
            <thead><tr><th>Stop Sequence</th><th>Stop Name</th><th>Northbound GPS (lat, lng)</th><th>Southbound GPS (lat, lng)</th><th>Actions</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8' }}>Loading Route 4 stops…</td></tr>}
              {!loading && stops.map((stop, index) => <tr key={stop.dbId}>
                <td><strong>{stop.code || `STOP-${String(index + 1).padStart(2, '0')}`}</strong></td>
                <td>{stop.name}</td>
                <td>{stop.northbound?.lat?.toFixed(6)}, {stop.northbound?.lng?.toFixed(6)}<br /><button type="button" className="btn btn-secondary" onClick={() => openEdit(stop, 'Northbound')}>Edit Northbound</button></td>
                <td>{stop.southbound?.lat?.toFixed(6)}, {stop.southbound?.lng?.toFixed(6)}<br /><button type="button" className="btn btn-secondary" onClick={() => openEdit(stop, 'Southbound')}>Edit Southbound</button></td>
                <td></td>
              </tr>)}
              {!loading && stops.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8' }}>No stops configured for Route 4.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {showAddForm && <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', zIndex: 2000, padding: '1rem', background: 'rgba(0,0,0,.8)' }}>
        <form className="modal-content card" onSubmit={handleSubmit} style={{ width: 'min(500px, 100%)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>{editingStop ? 'Edit Route Stop' : 'Add New Route Stop'}</h2>
            <button type="button" aria-label="Close" onClick={() => setShowAddForm(false)} className="btn btn-secondary" style={{ padding: '.35rem' }}><X size={18} /></button>
          </div>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <label className="form-label" htmlFor="route-stop-name">Stop Name</label>
          <input id="route-stop-name" className="form-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={160} />
          {editingStop && <p style={{ color: '#94a3b8' }}>Editing {form.direction} GPS coordinates. This test configuration is saved in this browser.</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', marginTop: '.75rem' }}>
            <div><label className="form-label" htmlFor="route-stop-lat">Latitude</label><input id="route-stop-lat" type="number" className="form-input" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} min="-90" max="90" step="any" required /></div>
            <div><label className="form-label" htmlFor="route-stop-lng">Longitude</label><input id="route-stop-lng" type="number" className="form-input" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} min="-180" max="180" step="any" required /></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.6rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editingStop ? 'Save Changes' : 'Add Route Stop'}</button>
          </div>
        </form>
      </div>}
    </div>
  );
}
