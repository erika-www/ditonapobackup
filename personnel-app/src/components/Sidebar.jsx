/**
 * Sidebar Component (React / JSX)
 * Navigation drawer for administrative portal duty operations and user session controls.
 * Includes Logout confirmation modal with automatic download of today's trip summary.
 */
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { generatePDFSummaryReport, downloadTripSummaryCSV } from '../services/pdfReportGenerator';
import { fetchDailyTripSummary } from '../services/supabaseClient';

export function Sidebar({ adminMode = false }) {
  const { dutySession, logout, isDutyRegistered } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);
  const [downloadingSummary, setDownloadingSummary] = useState(false);

  const handleDownloadTripSummary = async () => {
    try {
      setDownloadingSummary(true);
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const result = await fetchDailyTripSummary({ since: start.toISOString(), dutySession });
      const summaryData = result.success ? result.data : {};
      downloadTripSummaryCSV({ timeframe: 'Day', dutySession, summary: summaryData });
      generatePDFSummaryReport({ timeframe: 'Day', dutySession, summary: summaryData });
    } catch (err) {
      console.warn('Error downloading trip summary:', err);
    } finally {
      setDownloadingSummary(false);
    }
  };

  const handleLogoutClick = async () => {
    if (!adminMode && isDutyRegistered) {
      await handleDownloadTripSummary();
    }
    setShowLogoutConfirmModal(true);
  };

  const handleConfirmLogout = async () => {
    if (!adminMode && isDutyRegistered) {
      await handleDownloadTripSummary();
    }
    await logout();
    setShowLogoutConfirmModal(false);
    navigate('/admin-login');
  };

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <div className="sidebar-title">DITO NA PO</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>QC Transit Admin</div>
          </div>
        </div>

        <nav className="sidebar-menu">
          {adminMode ? (
            <>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, padding: '0.5rem 0.75rem 0.25rem 0.75rem', textTransform: 'uppercase' }}>Administration</div>
              <NavLink to="/admin" end className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                Personnel
              </NavLink>
              <NavLink to="/admin/personnel" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                Register Personnel
              </NavLink>
              <NavLink to="/admin/personnel-requests" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                Personnel Requests
              </NavLink>
              <NavLink to="/admin/admin-requests" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                Admin Requests
              </NavLink>
              <NavLink to="/admin/route-stops" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                Route Stops & Coordinates
              </NavLink>
              <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 800, padding: '0.75rem 0.75rem 0.25rem 0.75rem', textTransform: 'uppercase' }}>Duty Terminal</div>
              <NavLink to="/login" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                Bus Duty Check-in
              </NavLink>
            </>
          ) : null}

          {!adminMode && isDutyRegistered && (
            <>
              <NavLink to="/" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`} end>
                Route Information
              </NavLink>
              <NavLink to="/check-in" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                Passenger Summary
              </NavLink>
              <NavLink to="/summary" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                Daily Trip Summary
              </NavLink>
              <NavLink to="/settings" className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''}`}>
                Duty & Stop Settings
              </NavLink>
            </>
          )}
        </nav>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: 'auto' }}>
          {!adminMode && isDutyRegistered && dutySession && (
            <div style={{ fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{dutySession.driverName}</div>
              <div style={{ color: 'var(--color-accent)', fontSize: '0.75rem' }}>Unit {dutySession.plateNumber} ({dutySession.tripDirection})</div>
            </div>
          )}

          <button
            type="button"
            onClick={handleLogoutClick}
            className="sidebar-item"
            style={{ width: '100%', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--radius-sm)' }}
          >
            Log Out
          </button>
        </div>
      </aside>

      {/* Logout Confirmation & Auto Trip Download Modal */}
      {showLogoutConfirmModal && (
        <div className="modal-backdrop" style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem'
        }}>
          <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
            <div style={{ color: '#f87171', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Confirm Log Out</h3>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              {adminMode
                ? 'Are you sure you want to sign out of the administrator portal?'
                : "You are logging out of the operations portal. Today's trip summary has been automatically downloaded to your device."}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {!adminMode && (
                <button
                  type="button"
                  onClick={handleDownloadTripSummary}
                  disabled={downloadingSummary}
                  className="btn btn-secondary"
                  style={{ padding: '0.65rem', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 600 }}
                >
                  {downloadingSummary ? 'Downloading...' : "Download Trip Summary Again"}
                </button>
              )}

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
                  Confirm & Log Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
