import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchPassengerFeedback } from '../services/supabaseClient';
import { StopsAdminPage } from './StopsAdminPage';

export function SettingsPage() {
  const { dutySession } = useAuth();
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('qcbus_admin_theme');
    if (saved === 'light' || saved === 'dark' || saved === 'dim') return saved;
    return 'dark';
  });
  const [feedbacks, setFeedbacks] = useState([]);

  useEffect(() => {
    const activeTheme = (theme === 'light' || theme === 'dark' || theme === 'dim') ? theme : 'dark';
    document.documentElement.setAttribute('data-theme', activeTheme);
    localStorage.setItem('qcbus_admin_theme', activeTheme);
  }, [theme]);

  useEffect(() => {
    let mounted = true;
    const refreshFeedback = async () => {
      const result = await fetchPassengerFeedback();
      if (mounted && result.success) setFeedbacks(result.data);
    };
    refreshFeedback();
    const timer = setInterval(refreshFeedback, 10000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  const detailStyle = { color: 'var(--text-main)', fontWeight: 600, margin: '.3rem 0 0' };
  const labelStyle = { color: 'var(--text-muted)', fontSize: '.82rem', margin: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <header className="card">
        <h1 style={{ fontSize: '1.6rem', margin: '0 0 .25rem' }}>Duty Settings</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '.88rem', margin: 0 }}>View the active duty details and choose a display theme.</p>
      </header>

      <StopsAdminPage />

      <section className="card">
        <h2 style={{ fontSize: '1.15rem', margin: '0 0 1rem', color: 'var(--color-accent)' }}>
          Personnel On Duty & Bus Details
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {[
            ['Driver Name', dutySession.driverName],
            ['Driver ID', dutySession.driverId || dutySession.driverPersonnelId],
            ['Conductor Name', dutySession.conductorName],
            ['Dispatcher Name', dutySession.dispatcherName || 'Not assigned'],
            ['Plate Number', dutySession.plateNumber],
            ['Bus Capacity', dutySession.busCapacity],
            ['Trip Direction', dutySession.tripDirection]
          ].map(([label, value]) => (
            <div key={label} style={{ padding: '.8rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-subtle)' }}>
              <p style={labelStyle}>{label}</p>
              <p style={detailStyle}>{value || '—'}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 style={{ fontSize: '1.15rem', margin: '0 0 1rem', color: 'var(--color-accent)' }}>
          Theme Settings
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {[
            { id: 'light', label: 'Light', desc: 'Clean, high-clarity background' },
            { id: 'dark', label: 'Dark', desc: 'Default dark interface' },
            { id: 'dim', label: 'Dim', desc: 'Subdued dim contrast' }
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTheme(option.id)}
              aria-pressed={theme === option.id}
              style={{
                textAlign: 'left',
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                border: theme === option.id ? '2px solid var(--color-accent)' : '1px solid var(--border-color)',
                background: theme === option.id ? 'var(--bg-subtle)' : 'var(--bg-card)',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontWeight: 700, color: theme === option.id ? 'var(--color-accent)' : 'var(--text-main)', marginBottom: '.25rem' }}>
                {option.label}
              </div>
              <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{option.desc}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 style={{ fontSize: '1.15rem', margin: '0 0 1rem', color: 'var(--color-warning)' }}>
          Passenger App Feedbacks & Ratings
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
          {feedbacks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>No passenger feedback has been received yet.</p>
          ) : (
            feedbacks.map((feedback) => (
              <article key={feedback.id} style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-subtle)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.75rem', marginBottom: '.4rem' }}>
                  <span className="badge badge-warning">
                    {feedback.passenger_name || 'Passenger'} ({feedback.feedback_rating}/5 Rating)
                  </span>
                  <span style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
                    {feedback.updated_at ? new Date(feedback.updated_at).toLocaleDateString() : ''}
                  </span>
                </div>
                <p style={{ fontSize: '.9rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.4 }}>
                  {feedback.feedback_text || 'No written comment.'}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
