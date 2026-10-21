import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Palette, Star, User } from 'lucide-react';
import { fetchPassengerFeedback } from '../services/supabaseClient';
import { StopsAdminPage } from './StopsAdminPage';

export function SettingsPage() {
  const { dutySession } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('qcbus_admin_theme') || 'dark');
  const [feedbacks, setFeedbacks] = useState([]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('qcbus_admin_theme', theme);
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
  const labelStyle = { color: '#94a3b8', fontSize: '.82rem', margin: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <header className="card">
        <h1 style={{ fontSize: '1.6rem', margin: '0 0 .25rem' }}>Duty Settings</h1>
        <p style={{ color: '#94a3b8', fontSize: '.88rem', margin: 0 }}>View the active duty details and choose a display theme.</p>
      </header>

      <StopsAdminPage />

      <section className="card">
        <h2 style={{ fontSize: '1.15rem', margin: '0 0 1rem', color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          <User size={20} /> Personnel On Duty & Bus Details
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
            <div key={label} style={{ padding: '.8rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-subtle)' }}>
              <p style={labelStyle}>{label}</p>
              <p style={detailStyle}>{value || '—'}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 style={{ fontSize: '1.15rem', margin: '0 0 1rem', color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          <Palette size={20} /> Theme Settings
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {[
            { id: 'dark', label: 'Dark Transit', desc: 'Sleek dark mode interface' },
            { id: 'light', label: 'Light Clean', desc: 'Bright, high-clarity background' },
            { id: 'emerald', label: 'Emerald Bus', desc: 'QC green transit theme' },
            { id: 'contrast', label: 'High Contrast', desc: 'Maximum contrast visibility' }
          ].map((option) => (
            <button key={option.id} type="button" onClick={() => setTheme(option.id)} aria-pressed={theme === option.id} style={{ textAlign: 'left', padding: '1rem', borderRadius: '8px', border: theme === option.id ? '2px solid #06b6d4' : '1px solid var(--border-color)', background: theme === option.id ? 'rgba(6,182,212,.15)' : 'var(--bg-subtle)', cursor: 'pointer' }}>
              <div style={{ fontWeight: 700, color: theme === option.id ? '#38bdf8' : 'var(--text-main)', marginBottom: '.25rem' }}>{option.label}</div>
              <div style={{ fontSize: '.8rem', color: '#94a3b8' }}>{option.desc}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 style={{ fontSize: '1.15rem', margin: '0 0 1rem', color: '#eab308', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          <MessageSquare size={20} /> Passenger App Feedbacks & Ratings
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
          {feedbacks.length === 0 ? <p style={{ color: '#94a3b8', margin: 0 }}>No passenger feedback has been received yet.</p> : feedbacks.map((feedback) => (
            <article key={feedback.id} style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(15,23,42,.5)', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '.75rem', marginBottom: '.4rem' }}>
                <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem' }}>
                  {feedback.passenger_name || 'Passenger'} ({feedback.feedback_rating}/5 <Star size={12} fill="#fbbf24" color="#fbbf24" />)
                </span>
                <span style={{ fontSize: '.78rem', color: '#94a3b8' }}>{feedback.updated_at ? new Date(feedback.updated_at).toLocaleDateString() : ''}</span>
              </div>
              <p style={{ fontSize: '.9rem', color: '#cbd5e1', margin: 0, lineHeight: 1.4 }}>{feedback.feedback_text || 'No written comment.'}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
