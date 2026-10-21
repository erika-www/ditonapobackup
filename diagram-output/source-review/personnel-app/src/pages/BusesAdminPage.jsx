/**
 * BusesAdminPage Component (React / JSX)
 * Administrative portal for fleet vehicle inventory management.
 */
import React, { useEffect, useState } from 'react';
import { getAdminBuses, createBus, deleteBus } from '../services/api';
import { Plus, Trash2, X } from 'lucide-react';

export function BusesAdminPage() {
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    bus_code: '',
    display_name: '',
    plate_number: '',
    capacity: 60,
    is_active: true,
  });

  const loadBuses = async () => {
    try {
      setLoading(true);
      const data = await getAdminBuses();
      setBuses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuses();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createBus(formData);
      setShowModal(false);
      loadBuses();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create bus unit.');
    }
  };

  const handleDelete = async (id, code) => {
    if (!window.confirm(`Delete bus unit '${code}'?`)) return;
    try {
      await deleteBus(id);
      loadBuses();
    } catch (err) {
      alert(err.response?.data?.detail || 'Delete failed.');
    }
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Manage Fleet Units</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>QC Bus vehicle fleet master inventory.</p>
        </div>

        <button type="button" onClick={() => setShowModal(true)} className="btn btn-primary">
          <Plus size={16} /> Add Bus Unit
        </button>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Bus Code</th>
              <th>Display Name</th>
              <th>Plate Number</th>
              <th>Passenger Capacity</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Loading fleet...</td></tr>
            ) : buses.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No fleet units found.</td></tr>
            ) : (
              buses.map((b) => (
                <tr key={b.id}>
                  <td>
                    <span style={{ fontWeight: 700, color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {b.bus_code}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{b.display_name || '-'}</td>
                  <td>{b.plate_number || '-'}</td>
                  <td>{b.capacity ? `${b.capacity} passengers` : '-'}</td>
                  <td>
                    <span style={{ color: b.is_active ? '#34d399' : '#f87171', fontWeight: 600, fontSize: '0.8rem' }}>
                      {b.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button type="button" onClick={() => handleDelete(b.id, b.bus_code)} className="btn btn-danger" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>
                      <Trash2 size={14} /> Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Add Fleet Unit</h2>
              <button type="button" onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#94a3b8" /></button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Bus Code (Unique)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.bus_code}
                  onChange={(e) => setFormData({ ...formData, bus_code: e.target.value })}
                  placeholder="e.g. MOCK_BUS_107"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="e.g. QC Bus #107 (Electric)"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Plate Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.plate_number}
                    onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })}
                    placeholder="e.g. NQA-1007"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Passenger Capacity</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                    min={10}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Add Fleet Unit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
