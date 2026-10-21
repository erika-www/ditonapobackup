/**
 * RoutesAdminPage Component (React / JSX)
 * Administrative CRUD table for managing QC Bus routes.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminRoutes, createRoute, updateRoute, deleteRoute } from '../services/api';
import { Plus, Search, Edit2, Trash2, ListOrdered, X } from 'lucide-react';

export function RoutesAdminPage() {
  const [routes, setRoutes] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editRouteId, setEditRouteId] = useState(null);
  const [formData, setFormData] = useState({
    route_code: '',
    route_name: '',
    description: '',
    is_active: true,
  });

  const loadRoutes = async () => {
    try {
      setLoading(true);
      const data = await getAdminRoutes(search);
      setRoutes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoutes();
  }, [search]);

  const openCreateModal = () => {
    setEditRouteId(null);
    setFormData({ route_code: '', route_name: '', description: '', is_active: true });
    setShowModal(true);
  };

  const openEditModal = (r) => {
    setEditRouteId(r.id);
    setFormData({
      route_code: r.route_code,
      route_name: r.route_name,
      description: r.description || '',
      is_active: r.is_active,
    });
    setShowModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editRouteId) {
        await updateRoute(editRouteId, formData);
        setNotification({ type: 'success', text: `Route '${formData.route_code}' updated successfully.` });
      } else {
        await createRoute(formData);
        setNotification({ type: 'success', text: `Route '${formData.route_code}' created successfully.` });
      }
      setShowModal(false);
      loadRoutes();
    } catch (err) {
      setNotification({ type: 'danger', text: err.response?.data?.detail || 'Operation failed.' });
    }
  };

  const handleDelete = async (id, code) => {
    if (!window.confirm(`Are you sure you want to delete route '${code}'?`)) return;
    try {
      await deleteRoute(id);
      setNotification({ type: 'success', text: `Route '${code}' deleted.` });
      loadRoutes();
    } catch (err) {
      setNotification({ type: 'danger', text: err.response?.data?.detail || 'Delete failed.' });
    }
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Manage Routes</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Create, modify, and delete QC Bus transit routes.</p>
        </div>

        <button type="button" onClick={openCreateModal} className="btn btn-primary">
          <Plus size={16} /> Create New Route
        </button>
      </div>

      {notification && (
        <div className={`alert alert-${notification.type}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{notification.text}</span>
          <button type="button" onClick={() => setNotification(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      )}

      {/* Search Filter */}
      <div style={{ marginBottom: '1.25rem', maxWidth: '400px', position: 'relative' }}>
        <input
          type="text"
          className="form-input"
          style={{ paddingLeft: '2.5rem' }}
          placeholder="Search by code or route name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Search size={16} color="#64748b" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
      </div>

      {/* Routes Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Route Code</th>
              <th>Route Name</th>
              <th>Description</th>
              <th>Stops</th>
              <th>Data Source</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>Loading routes...</td></tr>
            ) : routes.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No routes found.</td></tr>
            ) : (
              routes.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span style={{ fontWeight: 700, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.12)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {r.route_code}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{r.route_name}</td>
                  <td style={{ color: '#94a3b8', maxWidth: '280px' }}>{r.description || '-'}</td>
                  <td>{r.stop_count ?? 0} stops</td>
                  <td><span style={{ fontSize: '0.75rem', color: '#06b6d4' }}>{r.data_source}</span></td>
                  <td>
                    <span style={{ color: r.is_active ? '#34d399' : '#f87171', fontWeight: 600, fontSize: '0.8rem' }}>
                      {r.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      <Link to={`/routes/${r.id}/sequence`} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }} title="Manage Stop Sequence">
                        <ListOrdered size={14} /> Sequence
                      </Link>
                      <button type="button" onClick={() => openEditModal(r)} className="btn btn-secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>
                        <Edit2 size={14} /> Edit
                      </button>
                      <button type="button" onClick={() => handleDelete(r.id, r.route_code)} className="btn btn-danger" style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}>
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

      {/* Modal Form */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {editRouteId ? 'Edit Route' : 'Create New Route'}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="#94a3b8" /></button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="form-group">
                <label className="form-label">Route Code (Unique)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.route_code}
                  onChange={(e) => setFormData({ ...formData, route_code: e.target.value })}
                  placeholder="e.g. MOCK_QC_07"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Route Display Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.route_name}
                  onChange={(e) => setFormData({ ...formData, route_name: e.target.value })}
                  placeholder="e.g. QC Route 7: City Hall to Project 8"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter route corridor description..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editRouteId ? 'Save Changes' : 'Create Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
