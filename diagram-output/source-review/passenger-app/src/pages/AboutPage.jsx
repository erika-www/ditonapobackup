/**
 * AboutPage Component (React / JSX)
 * Detailed information page covering the official Quezon City Bus Service Program
 * (Libreng Sakay sa Q City Bus) and the DITO NA PO passenger navigation system,
 * sourced directly from the Quezon City Government portal.
 */
import React, { useState } from 'react';
import { QC_ROUTES } from '../mockData';
import { Wind, Wifi, CreditCard, CheckCircle2 } from 'lucide-react';

export function AboutPage() {
  // Dropdown states for QC Bus Service section - all closed by default
  const [qcBusDropdowns, setQcBusDropdowns] = useState({});

  // Dropdown states for DITO NA PO section - all closed by default
  const [ditoNaPoDropdowns, setDitoNaPoDropdowns] = useState({});

  const toggleQcBus = (key) => {
    setQcBusDropdowns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleDitoNaPo = (key) => {
    setDitoNaPoDropdowns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const qcBusItems = [
    {
      id: 'freeCommute',
      title: '100% Libreng Sakay (Free Rides)',
      content: 'The Q City Bus service continues to offer free rides to help reduce transportation costs and provide comfortable, safe travel for all QCitizens, commuters, workers, and pregnant women.',
    },
    {
      id: 'airConditioned',
      title: 'Air-Conditioned & Free WiFi',
      content: 'Each Q City Bus is fully equipped with an air conditioning system and free onboard Wi-Fi internet access for passenger convenience during transit.',
    },
    {
      id: 'operatingSchedule',
      title: 'Daily Operating Schedule & Accessibility',
      content: 'Buses operate daily except on official holidays. All buses feature designated priority seating for Senior Citizens, PWDs, and Pregnant women.',
    },
    {
      id: 'ebuses',
      title: 'Eco-Friendly Electric Bus Fleet (E-Buses)',
      content: 'Quezon City is actively converting its Q City Bus fleet to zero-emission Electric Buses (E-Buses) as part of the city’s green public transport initiative.',
    }
  ];

  const ditoNaPoItems = [
    {
      id: 'liveTracking',
      title: 'Real-Time GPS Bus Tracking',
      content: 'Live tracking map displaying exact bus positions, stop sequences, travel duration, and estimated arrival times (ETAs).',
    },
    {
      id: 'qrPasses',
      title: 'Digital Boarding Passes & QCitizen ID',
      content: 'Passengers present their QCitizen ID or generate digital QR boarding passes directly on mobile devices for seamless bus boarding.',
    },
    {
      id: 'capacityMonitor',
      title: 'Passenger Seating & Capacity Monitor',
      content: 'Real-time seating availability monitor tracking Priority Seats (Senior, PWD, Pregnant), Regular Seats, and Standing capacity on incoming buses.',
    },
  ];

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1rem 0', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

      {/* Header Banner - QC Government Aesthetic */}
      <div className="glass-card" style={{
        backgroundColor: 'var(--bg-subtle)',
        border: '1px solid var(--border-color)',
        padding: '2rem',
        borderRadius: '16px'
      }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', marginBottom: '0.6rem' }}>
          Quezon City Bus Service Program
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.6, maxWidth: '820px' }}>
          Providing safe, reliable, and <strong>100% free bus transit</strong> for commuters in Quezon City except on holidays.
        </p>

        {/* Feature Pill Highlights */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--bg-subtle)', padding: '0.4rem 0.85rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
            <CheckCircle2 size={16} style={{ color: '#16a34a' }} /> 100% Free Rides
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--bg-subtle)', padding: '0.4rem 0.85rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
            <Wind size={16} style={{ color: '#0284c7' }} /> Air-Conditioned
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--bg-subtle)', padding: '0.4rem 0.85rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600 }}>
            <Wifi size={16} style={{ color: '#8b5cf6' }} /> Free WiFi Onboard
          </div>
        </div>
      </div>

      {/* SECTION 1: Program Guidelines & Features */}
      <section style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--primary)', marginBottom: '0.5rem' }}>
          Program Features & Guidelines
        </h2>

        {/* Dropdown Items */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {qcBusItems.map((item) => {
            const isOpen = !!qcBusDropdowns[item.id];
            return (
              <div
                key={item.id}
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  padding: '1rem 0',
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleQcBus(item.id)}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                    {item.title}
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', marginLeft: '1rem' }}>
                    {isOpen ? '−' : '+'}
                  </span>
                </button>

                {isOpen && (
                  <div style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                    {item.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: Official Route Directory & Color Scheme (Routes 1 to 8) */}
      <section style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
            Official Bus Routes & Stops
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
            Quezon City operates 8 official bus routes. Each route is designated with a unique color code for easy identification.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {QC_ROUTES.map((route) => (
            <div
              key={route.id}
              className="glass-card"
              style={{
                borderLeft: `6px solid ${route.color}`,
                padding: '1.25rem 1.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{
                    backgroundColor: route.color,
                    color: '#ffffff',
                    padding: '0.25rem 0.65rem',
                    borderRadius: '6px',
                    fontWeight: 800,
                    fontSize: '0.85rem'
                  }}>
                    {route.code}
                  </span>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', margin: 0 }}>
                    {route.name}
                  </h3>
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {route.totalDistanceKm} km • ~{route.estMinutes} mins
                </span>
              </div>

              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.85rem' }}>
                {route.description}
              </p>

              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                Designated Bus Stops:
              </div>

              <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                {route.stops && route.stops.map((stop) => (
                  <li key={stop.id} style={{ marginBottom: '0.25rem' }}>
                    <strong>{stop.name}</strong> {stop.landmark ? `— ${stop.landmark}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3: DITO NA PO System Integration */}
      <section>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--primary)', marginBottom: '0.5rem' }}>
          DITO NA PO Passenger Navigation Portal
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
          DITO NA PO is an AI-enhanced passenger tracking portal created to provide commuters real-time GPS locations, arrival ETAs, seat occupancy data, and instant digital QR boarding passes.
        </p>

        {/* DITO NA PO Dropdowns */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {ditoNaPoItems.map((item) => {
            const isOpen = !!ditoNaPoDropdowns[item.id];
            return (
              <div
                key={item.id}
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  padding: '1rem 0',
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleDitoNaPo(item.id)}
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    outline: 'none',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                    {item.title}
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)', marginLeft: '1rem' }}>
                    {isOpen ? '−' : '+'}
                  </span>
                </button>

                {isOpen && (
                  <div style={{ marginTop: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
                    {item.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}


