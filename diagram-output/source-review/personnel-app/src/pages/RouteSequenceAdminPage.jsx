/**
 * RouteSequenceAdminPage Component (React / JSX)
 * Administrative portal page for reordering stop sequences up/down and updating ETAs.
 */
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAdminRoutes, getRouteStops, getAdminStops, addStopToRoute, reorderRouteStops, removeStopFromRoute } from '../services/api';
import { ArrowLeft, ArrowUp, ArrowDown, Plus, Trash2, Save } from 'lucide-react';

export function RouteSequenceAdminPage() {
  const { id } = useParams();
  const routeId = Number(id);

  const [route, setRoute] = useState(null);
  const [routeStops, setRouteStops] = useState([]);
  const [allStops, setAllStops] = useState([]);
  const [selectedStopId, setSelectedStopId] = useState('');
  const [estMinutes, setEstMinutes] = useState(5);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  const loadData = async () => {
    if (!routeId) return;
    try {
      setLoading(true);
      const [routes, rs, stops] = await Promise.all([
        getAdminRoutes(),
        getRouteStops(routeId),
        getAdminStops(),
      ]);
      const currentRoute = routes.find((r) => r.id === routeId);
      setRoute(currentRoute || null);
      setRouteStops(rs);
      setAllStops(stops);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [routeId]);

  const handleMove = (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= routeStops.length) return;

    const newStops = [...routeStops];
    const temp = newStops[index];
    newStops[index] = newStops[targetIndex];
    newStops[targetIndex] = temp;

    newStops.forEach((item, idx) => {
      item.stop_sequence = idx + 1;
    });

    setRouteStops(newStops);
  };

  const handleSaveSequence = async () => {
    try {
      setSaving(true);
      const payload = routeStops.map((item, idx) => ({
        stop_id: item.stop_id,
        stop_sequence: idx + 1,
      }));
      await reorderRouteStops(routeId, payload);
      setNotification('Route stop sequence updated successfully!');
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save sequence.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddStop = async () => {
    if (!selectedStopId) return;
    try {
      const nextSequence = routeStops.length + 1;
      await addStopToRoute(routeId, Number(selectedStopId), nextSequence, estMinutes);
      setSelectedStopId('');
      setNotification('Stop added to sequence.');
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add stop to route.');
    }
  };

  const handleRemoveStop = async (stopId) => {
    if (!window.confirm('Remove stop from this route sequence?')) return;
    try {
      await removeStopFromRoute(routeId, stopId);
      setNotification('Stop removed from sequence.');
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to remove stop.');
    }
  };

  if (loading) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>Loading sequence manager...</div>;
  }

  if (!route) {
    return <div style={{ padding: '3rem' }}>Route not found. <Link to="/routes">Back to routes</Link></div>;
  }

  return (
    <div>
      <Link to="/routes" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
        <ArrowLeft size={16} /> Back to Routes
      </Link>

      <div className="admin-header">
        <div>
          <span style={{ fontWeight: 700, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>
            {route.route_code}
          </span>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.25rem' }}>
            {route.route_name} — Sequence Manager
          </h1>
        </div>

        <button type="button" onClick={handleSaveSequence} className="btn btn-primary" disabled={saving}>
          <Save size={16} /> {saving ? 'Saving...' : 'Save Sequence Order'}
        </button>
      </div>

      {notification && (
        <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>
          {notification}
        </div>
      )}

      {/* Add Stop Control Panel */}
      <div className="stat-card" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <label className="form-label">Add Stop to Sequence</label>
          <select
            className="form-select"
            value={selectedStopId}
            onChange={(e) => setSelectedStopId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">-- Select Stop from Master Directory --</option>
            {allStops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.stop_code} — {s.stop_name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ width: '140px' }}>
          <label className="form-label">Est. Travel Mins</label>
          <input
            type="number"
            className="form-input"
            value={estMinutes}
            onChange={(e) => setEstMinutes(Number(e.target.value))}
            min={0}
          />
        </div>

        <button type="button" onClick={handleAddStop} className="btn btn-secondary" disabled={!selectedStopId}>
          <Plus size={16} /> Add to Sequence
        </button>
      </div>

      {/* Sequence Order List Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Sequence</th>
              <th>Stop Code</th>
              <th>Stop Name & Address</th>
              <th>Est. Travel Time</th>
              <th style={{ textAlign: 'right' }}>Reorder & Actions</th>
            </tr>
          </thead>
          <tbody>
            {routeStops.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No stops assigned to this route yet. Add stops above.</td></tr>
            ) : (
              routeStops.map((item, idx) => (
                <tr key={item.id}>
                  <td>
                    <span style={{ background: '#06b6d4', color: '#ffffff', fontWeight: 800, width: '28px', height: '28px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
                      {idx + 1}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: '#06b6d4' }}>{item.stop?.stop_code || `ID #${item.stop_id}`}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.stop?.stop_name || 'Stop'}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{item.stop?.address || '-'}</div>
                  </td>
                  <td>{item.estimated_travel_minutes != null ? `+${item.estimated_travel_minutes} mins` : '-'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => handleMove(idx, 'up')}
                        disabled={idx === 0}
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.5rem', opacity: idx === 0 ? 0.4 : 1 }}
                        title="Move Up"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(idx, 'down')}
                        disabled={idx === routeStops.length - 1}
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.5rem', opacity: idx === routeStops.length - 1 ? 0.4 : 1 }}
                        title="Move Down"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveStop(item.stop_id)}
                        className="btn btn-danger"
                        style={{ padding: '0.3rem 0.5rem' }}
                        title="Remove from Route"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
