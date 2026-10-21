/**
 * TripsAdminPage Component (React / JSX)
 * Administrative page for monitoring and updating real-time bus trip operation statuses.
 */
import React, { useEffect, useState } from 'react';
import { getAdminTrips, updateTrip, deleteTrip } from '../services/api';
import { Trash2, Edit2, X } from 'lucide-react';

export function TripsAdminPage() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit status modal
  const [editingTrip, setEditingTrip] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('IN_TRANSIT');

  const loadData = async () => {
    try {
      setLoading(true);
      const tData = await getAdminTrips();
      setTrips(tData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusUpdate = async () => {
    if (!editingTrip) return;
    try {
      await updateTrip(editingTrip.id, { status: selectedStatus });
      setEditingTrip(null);
      loadData();
    } catch (err) {
      alert('Failed to update trip status.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete trip log?')) return;
    try {
      await deleteTrip(id);
      loadData();
    } catch (err) {
      alert('Delete failed.');
    }
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Manage Trip Operations</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Real-time trip statuses, active dispatches, and logs.</p>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Trip ID</th>
              <th>Assigned Route</th>
              <th>Assigned Fleet Unit</th>
              <th>Status</th>
              <th>Created At</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Loading trip logs...</td></tr>
            ) : trips.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No trips logged.</td></tr>
            ) : (
              trips.map((t) => (
                <tr key={t.id}>
                  <td>#{t.id}</td>
                  <td style={{ fontWeight: 600 }}>{t.route ? `${t.route.route_code}: ${t.route.route_name}` : `Route #${t.route_id}`}</td>
                  <td>{t.bus ? t.bus.display_name : `Bus Unit #${t.bus_id || 'N/A'}`}</td>
                  <td>
                    <span style={{ fontWeight: 700, fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.08)' }}>
                      {t.status}
                    </span>
                  </td>
                  <td style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{new Date(t.created_at).toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => { setEditingTrip(t); setSelectedStatus(t.status); }} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>
                        <Edit2 size={14} /> Update Status
                      </button>
                      <button type="button" onClick={() => handleDelete(t.id)} className="btn btn-danger" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editingTrip && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Update Trip #{editingTrip.id} Status</h2>
              <button type="button" onClick={() => setEditingTrip(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#94a3b8" /></button>
            </div>

            <div className="form-group">
              <label className="form-label">Select Operational Status</label>
              <select
                className="form-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="SCHEDULED">SCHEDULED</option>
                <option value="IN_TRANSIT">IN_TRANSIT (Active Dispatch)</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="DELAYED">DELAYED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button type="button" onClick={() => setEditingTrip(null)} className="btn btn-secondary">Cancel</button>
              <button type="button" onClick={handleStatusUpdate} className="btn btn-primary">Update Status</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
