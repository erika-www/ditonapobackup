/**
 * SchedulesAdminPage Component (React / JSX)
 * Administrative portal for managing route departure schedules.
 */
import React, { useEffect, useState } from 'react';
import { getAdminSchedules, getAdminRoutes, createSchedule, deleteSchedule } from '../services/api';
import { Plus, Trash2, X } from 'lucide-react';

export function SchedulesAdminPage() {
  const [schedules, setSchedules] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    route_id: 1,
    service_day: 'DAILY',
    departure_time: '06:00',
    arrival_time: '07:30',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [sData, rData] = await Promise.all([
        getAdminSchedules(),
        getAdminRoutes(),
      ]);
      setSchedules(sData);
      setRoutes(rData);
      if (rData.length > 0) {
        setFormData((prev) => ({ ...prev, route_id: rData[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createSchedule(formData);
      setShowModal(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create schedule.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete schedule?')) return;
    try {
      await deleteSchedule(id);
      loadData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed.');
    }
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Manage Schedules</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Configure departure and arrival schedules for QC Bus routes.</p>
        </div>

        <button type="button" onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={16} /> Add Schedule
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Route</th>
              <th>Service Day</th>
              <th>Departure Time</th>
              <th>Est. Arrival Time</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Loading schedules...</td></tr>
            ) : schedules.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No schedule records found.</td></tr>
            ) : (
              schedules.map((s) => {
                const route = routes.find((r) => r.id === s.route_id);
                return (
                  <tr key={s.id}>
                    <td>#{s.id}</td>
                    <td style={{ fontWeight: 600 }}>{route ? `${route.route_code}: ${route.route_name}` : `Route #${s.route_id}`}</td>
                    <td>
                      <span style={{ fontWeight: 700, color: '#06b6d4', background: 'rgba(6, 182, 212, 0.12)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                        {s.service_day}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: '#ffffff' }}>{s.departure_time}</td>
                    <td style={{ color: '#94a3b8' }}>{s.arrival_time || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" onClick={() => handleDelete(s.id)} className="btn btn-danger" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Add Route Schedule</h2>
              <button type="button" onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#94a3b8" /></button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Select Route</label>
                <select
                  className="form-select"
                  value={formData.route_id}
                  onChange={(e) => setFormData({ ...formData, route_id: Number(e.target.value) })}
                >
                  {routes.map((r) => (
                    <option key={r.id} value={r.id}>{r.route_code} — {r.route_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Service Day</label>
                <select
                  className="form-select"
                  value={formData.service_day}
                  onChange={(e) => setFormData({ ...formData, service_day: e.target.value })}
                >
                  <option value="DAILY">DAILY</option>
                  <option value="WEEKDAY">WEEKDAY (Mon-Fri)</option>
                  <option value="WEEKEND">WEEKEND (Sat-Sun)</option>
                  <option value="MONDAY">MONDAY</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Departure Time (HH:MM)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.departure_time}
                    onChange={(e) => setFormData({ ...formData, departure_time: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Est. Arrival Time (HH:MM)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.arrival_time}
                    onChange={(e) => setFormData({ ...formData, arrival_time: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Create Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
