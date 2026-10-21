/**
 * HomePage Component (React / JSX)
 * Welcoming landing page presenting the Quezon City Bus system, key features,
 * step-by-step user guide, and quick action buttons.
 */
import React from 'react';
import { Play, MapPin, QrCode, Users, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function HomePage({ onStartTrip, onOpenPassengerDashboard, onSelectRoutePreview }) {
  const { currentUser } = useAuth();

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Personalized Logged-In User Banner */}
      {currentUser && (
        <div style={{
          backgroundColor: 'var(--primary-light)',
          border: '1px solid var(--primary)',
          padding: '1.1rem 1.5rem',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 2px 8px rgba(2, 132, 199, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.1rem'
            }}>
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <strong style={{ fontSize: '1.1rem', color: 'var(--primary)', display: 'block' }}>
                Welcome back, {currentUser.name}!
              </strong>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenPassengerDashboard || onStartTrip}
            className="btn-primary"
            style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <UserCheck size={18} /> Open Passenger Dashboard
          </button>
        </div>
      )}

      {/* Hero Banner Section */}
      <div className="glass-card" style={{
        padding: '2.5rem 2rem',
        backgroundColor: 'var(--bg-subtle)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ maxWidth: '750px', position: 'relative', zIndex: 2 }}>
          <h1 style={{ fontSize: '2.4rem', lineHeight: 1.2, marginBottom: '1rem', fontFamily: 'var(--font-heading)' }}>
            Fast & Free Commute Across Quezon City
          </h1>
          <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.75rem' }}>
            Track real-time bus locations, generate instant digital QR boarding passes, check seat availability, and travel hassle-free across main city routes.
          </p>

          {!currentUser && (
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={onStartTrip} className="btn-primary" style={{ padding: '0.85rem 1.75rem', fontSize: '1rem' }}>
                <Play size={20} fill="currentColor" /> Start Trip Now
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid-3">
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.75rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              minWidth: '44px',
              borderRadius: '10px',
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <QrCode size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-heading)' }}>
              Digital QR Passes
            </h3>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Instant QR pass generation with option to download and save directly to your mobile device for quick scanning.
          </p>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.75rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              minWidth: '44px',
              borderRadius: '10px',
              backgroundColor: 'var(--secondary-light)',
              color: 'var(--secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <MapPin size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-heading)' }}>
              Live Bus Tracking
            </h3>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            GPS-enabled interactive map showing exact bus positions, stop sequences, travel duration, and ETAs.
          </p>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.75rem' }}>
            <div style={{
              width: '44px',
              height: '44px',
              minWidth: '44px',
              borderRadius: '10px',
              backgroundColor: 'var(--warning-light)',
              color: 'var(--warning)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={24} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-heading)' }}>
              Passenger Seating Monitor
            </h3>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Real-time capacity tracking for priority and non-priority seats, and standing capacity.
          </p>
        </div>
      </div>

      {/* How the System Works */}
      <div className="glass-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.6rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>
            How DITO NA PO Works
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '600px', margin: '0 auto' }}>
            Follow 4 simple steps to enjoy safe, fast, and 100% free bus transit across Quezon City.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1.25rem' }}>
          {/* Step 1 */}
          <div style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              fontWeight: 800,
              margin: '0 auto 1rem auto'
            }}>
              1
            </div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Choose Stops & Route</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Select your boarding stop and destination on Route 4 (QC Hall to General Luis) with real-time GPS tracking.
            </p>
          </div>

          {/* Step 2 */}
          <div style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--secondary-light)',
              color: 'var(--secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              fontWeight: 800,
              margin: '0 auto 1rem auto'
            }}>
              2
            </div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Generate & Scan QR</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Get your instant digital QR boarding pass on your mobile device. Present it to the bus conductor upon entry.
            </p>
          </div>

          {/* Step 3 */}
          <div style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'var(--warning-light)',
              color: 'var(--warning)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              fontWeight: 800,
              margin: '0 auto 1rem auto'
            }}>
              3
            </div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Monitor Live GPS</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Track real-time bus location, priority seating capacity (Seniors/PWDs/Pregnant), and live ETAs on the interactive map.
            </p>
          </div>

          {/* Step 4 */}
          <div style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-subtle)',
            border: '1px solid var(--border-color)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(139, 92, 246, 0.15)',
              color: '#8b5cf6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              fontWeight: 800,
              margin: '0 auto 1rem auto'
            }}>
              4
            </div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Enjoy the Ride</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Relax on board your air-conditioned and free QC bus and arrive at your stop hassle-free!
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <button type="button" onClick={onStartTrip} className="btn-primary" style={{ padding: '0.85rem 2rem', fontSize: '1rem' }}>
            <Play size={20} fill="currentColor" /> Start Your Journey Now
          </button>
        </div>
      </div>
    </div>
  );
}
