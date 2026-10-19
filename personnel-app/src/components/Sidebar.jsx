/**
 * Sidebar Component (React / JSX)
 * Navigation drawer for administrative portal duty operations and user session controls.
 * Includes Logout confirmation modal with option to download today's trip summary.
 */
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { generatePDFSummaryReport } from '../services/pdfReportGenerator';
import { fetchDailyTripSummary } from '../services/supabaseClient';
import { Navigation, Users, BarChart3, Settings, LogOut, ShieldCheck, Download, AlertTriangle, UserRoundPlus, Clock3, MapPin } from 'lucide-react';

export function Sidebar({ adminMode = false }) {
  const { dutySession, logout, isDutyRegistered } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);

  const handleConfirmLogout = () => {
    logout();
    setShowLogoutConfirmModal(false);
    navigate('/admin-login');
  };

  const handleDownloadTripSummary = async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const result = await fetchDailyTripSummary({ since: start.toISOString(), dutySession });
    generatePDFSummaryReport({ timeframe: 'Day', dutySession, summary: result.success ? result.data : {} });
  };

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-header">
          <ShieldCheck size={28} color="#06b6d4" />
          <div>
            <div className="sidebar-title">DITO NA PO</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>QC Transit Admin</div>
          </div>
        </div>

        <nav className="sidebar-menu">
          {adminMode ? <>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, padding: '0.5rem 0.75rem 0.25rem 0.75rem', textTransform: 'uppercase' }}>Administration</div>
            <NavLink to="/admin" end className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <Users size={18} /> Personnel
            </NavLink>
            <NavLink to="/admin/personnel" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <UserRoundPlus size={18} /> Register Personnel
            </NavLink>
            <NavLink to="/admin/personnel-requests" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <Clock3 size={18} /> Personnel Requests
            </NavLink>
            <NavLink to="/admin/admin-requests" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <ShieldCheck size={18} /> Admin Requests
            </NavLink>
            <NavLink to="/admin/route-stops" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <MapPin size={18} /> Route Stops & Coordinates
            </NavLink>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, padding: '0.75rem 0.75rem 0.25rem 0.75rem', textTransform: 'uppercase' }}>Duty Terminal</div>
            <NavLink to="/login" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <Navigation size={18} /> Bus Duty Check-in
            </NavLink>
          </> : <>
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, padding: '0.5rem 0.75rem 0.25rem 0.75rem', textTransform: 'uppercase' }}>Duty Operations</div>
            <NavLink to="/login" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <UserRoundPlus size={18} /> Register Bus Duty
            </NavLink>
            <NavLink to="/admin" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <ShieldCheck size={18} /> Admin Exclusive Portal
            </NavLink>
          </>}

          {!adminMode && isDutyRegistered && <>
            <NavLink to="/" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`} end>
              <Navigation size={18} /> Route Information
            </NavLink>
            <NavLink to="/check-in" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <Users size={18} /> Passenger Summary
            </NavLink>
            <NavLink to="/summary" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <BarChart3 size={18} /> Daily Trip Summary
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
              <Settings size={18} /> Duty & Stop Settings
            </NavLink>
          </>}
        </nav>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: 'auto' }}>
          {!adminMode && isDutyRegistered && dutySession && (
            <div style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 600, color: '#f8fafc' }}>{dutySession.driverName}</div>
              <div style={{ color: '#06b6d4', fontSize: '0.75rem' }}>Unit {dutySession.plateNumber} ({dutySession.tripDirection})</div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowLogoutConfirmModal(true)}
            className="sidebar-item"
            style={{ width: '100%', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <LogOut size={18} /> Log Out
          </button>
        </div>
      </aside>

      {/* Logout Confirmation & Trip Download Modal */}
      {showLogoutConfirmModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem'
        }}>
          <div className="modal-content card" style={{ maxWidth: '480px', width: '100%', padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#f87171', marginBottom: '0.75rem' }}>
              <AlertTriangle size={24} />
              <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Confirm Log Out</h3>
            </div>

            <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              {adminMode
                ? 'Are you sure you want to sign out of the administrator portal?'
                : "Are you sure you want to log out of the operations portal? You can download today's trip summary before signing out."}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {!adminMode && <button
                type="button"
                onClick={handleDownloadTripSummary}
                className="btn btn-secondary"
                style={{ padding: '0.75rem', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Download size={16} /> Download Day's Trip Summary
              </button>}

              <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.35rem' }}>
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirmModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, justifyContent: 'center', padding: '0.65rem' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLogout}
                  className="btn btn-danger"
                  style={{ flex: 1, justifyContent: 'center', padding: '0.65rem', fontWeight: 700 }}
                >
                  <LogOut size={16} /> Confirm & Log Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
