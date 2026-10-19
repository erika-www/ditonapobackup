import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, RefreshCw, Users, ShieldCheck, UserCheck, AlertCircle, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchOngoingTripForBus,
  fetchPassengerRegistry,
  recordBoardingEvent,
  fetchTripOccupancy,
  fetchJourneyByQrToken
} from '../services/supabaseClient';
import { ROUTE4_STOPS } from '@shared/route4Stops';
import { parsePassengerQRCode, isPriorityCategory } from '@shared/qrPassUtils';

const timeLabel = (value) => (value
  ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  : '—');

const normalizeStopName = (name) => String(name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function PassengerCheckInPage() {
  const { dutySession } = useAuth();
  const [tripId, setTripId] = useState(dutySession?.tripId || null);
  const [registry, setRegistry] = useState([]);
  const [occupancy, setOccupancy] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showStopBreakdown, setShowStopBreakdown] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setTripId(null);
    setRegistry([]);
    setOccupancy(null);
    setError('');
    if (!dutySession?.plateNumber) {
      setError('No bus is assigned to this duty session.');
      return undefined;
    }
    fetchOngoingTripForBus(dutySession.plateNumber).then((result) => {
      if (cancelled) return;
      if (result.success && result.data?.id) setTripId(result.data.id);
      // An idle bus has no passenger scan session yet; keep the page usable without a blocking alert.
    });
    return () => { cancelled = true; };
  }, [dutySession?.plateNumber]);

  const refresh = useCallback(async () => {
    if (!tripId) return;
    const [registryResult, occupancyResult] = await Promise.all([
      fetchPassengerRegistry(tripId),
      fetchTripOccupancy(tripId)
    ]);
    if (registryResult.success) setRegistry(registryResult.data);
    else setError(registryResult.error);
    if (occupancyResult.success) setOccupancy(occupancyResult.data);
  }, [tripId]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [refresh]);

  // Total seat calculation: 20 Priority, 30 Regular = 50 total
  const priorityBoarded = registry.filter((j) => (
    j.status === 'boarded' && isPriorityCategory(j.passenger_category || j.profiles?.passenger_category || j.category)
  )).reduce((acc, curr) => acc + (Number(curr.count) || 1), 0);

  const regularBoarded = registry.filter((j) => (
    j.status === 'boarded' && !isPriorityCategory(j.passenger_category || j.profiles?.passenger_category || j.category)
  )).reduce((acc, curr) => acc + (Number(curr.count) || 1), 0);

  const availablePrioritySeats = Math.max(0, 20 - priorityBoarded);
  const availableRegularSeats = Math.max(0, 30 - regularBoarded);
  const totalOnboard = priorityBoarded + regularBoarded;

  // Stop statistics: boarded count at boarding stop, alighting count at destination stop
  const getStopStats = (stopName) => {
    const norm = normalizeStopName(stopName);
    const boarded = registry.filter((j) => (
      (j.status === 'boarded' || j.status === 'completed') && normalizeStopName(j.origin_name) === norm
    )).reduce((acc, curr) => acc + (Number(curr.count) || 1), 0);

    const alighting = registry.filter((j) => (
      j.status === 'boarded' && normalizeStopName(j.destination_name) === norm
    )).reduce((acc, curr) => acc + (Number(curr.count) || 1), 0);

    const completedAlighted = registry.filter((j) => (
      j.status === 'completed' && normalizeStopName(j.destination_name) === norm
    )).reduce((acc, curr) => acc + (Number(curr.count) || 1), 0);

    return { boarded, alighting, completedAlighted };
  };

  const recordEvent = async (journey, eventType) => {
    const effectiveTripId = tripId || dutySession?.tripId || 'operational-trip';
    setBusyId(journey.id);
    setError('');
    setNotice('');

    const isPri = isPriorityCategory(journey.passenger_category || journey.profiles?.passenger_category || journey.category);
    const catName = journey.passenger_category || journey.profiles?.passenger_category || journey.category || 'Regular';

    const result = await recordBoardingEvent({
      tripId: effectiveTripId,
      eventType,
      method: 'qr',
      passengerId: journey.passenger_id || null,
      journeyId: journey.id,
      idempotencyKey: `registry-${journey.id}-${eventType}-${Date.now()}`
    });

    if (!result.success) {
      setError(result.error);
    } else {
      if (eventType === 'board') {
        const remainingPriority = isPri ? Math.max(0, availablePrioritySeats - 1) : availablePrioritySeats;
        const remainingRegular = !isPri ? Math.max(0, availableRegularSeats - 1) : availableRegularSeats;
        setNotice(
          `✓ PASSENGER BOARDED (${catName}). Decremented ${isPri ? `Priority Seats (now ${remainingPriority}/20)` : `Regular Seats (now ${remainingRegular}/30)`}. Boarded at: ${journey.origin_name || 'Stop 1'} | Alights at: ${journey.destination_name || 'End Stop'}.`
        );
      } else {
        setNotice(`✓ PASSENGER ALIGHTED at ${journey.destination_name || 'Destination'}. Seat freed.`);
      }
    }

    await refresh();
    setBusyId(null);
  };

  const processScannedCode = async (rawCode) => {
    const raw = String(rawCode || '').trim();
    if (!raw) return;
    setError('');
    setNotice('');

    const parsed = parsePassengerQRCode(raw);
    const token = parsed?.tripId || raw.match(/(?:Code|Journey ID|Pass ID):\s*([^\r\n]+)/i)?.[1]?.trim() || raw;

    const found = await fetchJourneyByQrToken(token || raw);
    if (!found.success || !found.data) {
      setError(found.error || 'QR pass was not recognized or found in registry.');
      scannerRef.current?.focus();
      return;
    }

    const journey = found.data;
    if (journey.trip_id && tripId && journey.trip_id !== tripId) {
      setError(`Notice: Passenger is assigned to a different trip (${journey.trip_id}). Recording anyway for passenger safety.`);
    }

    const nextEventType = journey.status === 'boarded' ? 'alight' : 'board';
    await recordEvent(journey, nextEventType);
    scannerRef.current?.focus();
  };

  const handleScanFormSubmit = async (event) => {
    event.preventDefault();
    const raw = event.currentTarget.elements.qr.value.trim();
    event.currentTarget.reset();
    await processScannedCode(raw);
  };

  const dailyCounts = {};
  const dailyIds = registry.map((journey) => {
    const date = new Date(journey.created_at || Date.now()).toLocaleDateString();
    dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    return `PAX-${String(dailyCounts[date]).padStart(3, '0')}`;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* TOP SUMMARY CARD */}
      <section className="card" style={{ background: '#123b3b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '.3rem' }}>Passenger Check-in & QR Operations</h1>
            <p style={{ color: '#94a3b8', margin: '.35rem 0 0' }}>
              Duty bus: <strong>{dutySession?.plateNumber || occupancy?.bus_plate || 'QC-BUS'}</strong> | Assigned Driver: <strong>{dutySession?.driverName}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            <form onSubmit={handleScanFormSubmit} style={{ display: 'flex', gap: '.4rem' }}>
              <input
                ref={scannerRef}
                name="qr"
                className="form-input"
                autoFocus
                autoComplete="off"
                placeholder="USB scanner ready"
                aria-label="USB QR barcode scanner input"
                style={{ width: '14rem', padding: '.45rem .6rem' }}
              />
            </form>
            <button type="button" onClick={refresh} className="btn btn-secondary">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* 4 REAL-TIME SEAT CAPACITY & OCCUPANCY METRICS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
          {/* Metric 1: Available Priority Seats (/20) */}
          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', border: '1px solid #f59e0b', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.25rem' }}>
              <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase' }}>
                PRIORITY SEATS AVAILABLE
              </span>
              <ShieldCheck size={16} color="#fbbf24" />
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#fef08a' }}>
              {availablePrioritySeats} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>/ 20</span>
            </div>
          </div>

          {/* Metric 2: Available Regular Seats (/30) */}
          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', border: '1px solid #06b6d4', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.25rem' }}>
              <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                REGULAR SEATS AVAILABLE
              </span>
              <UserCheck size={16} color="#38bdf8" />
            </div>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#e0f2fe' }}>
              {availableRegularSeats} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>/ 30</span>
            </div>
          </div>

          {/* Metric 3: Total Onboard */}
          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', border: '1px solid #10b981', borderRadius: '10px', padding: '1rem' }}>
            <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', display: 'block', marginBottom: '.25rem' }}>
              TOTAL PASSENGERS ONBOARD
            </span>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#10b981' }}>
              {totalOnboard} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>/ 50 Capacity</span>
            </div>
          </div>

          {/* Metric 4: Total Registered Passes */}
          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', border: '1px solid #475569', borderRadius: '10px', padding: '1rem' }}>
            <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', display: 'block', marginBottom: '.25rem' }}>
              TOTAL REGISTERED PASSES
            </span>
            <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#f8fafc' }}>
              {registry.length} Passes
            </div>
          </div>
        </div>
      </section>

      {notice && <div className="alert alert-success" style={{ padding: '.85rem 1rem', fontSize: '.9rem', lineHeight: 1.4 }}>{notice}</div>}
      {error && <div className="alert alert-danger" style={{ padding: '.85rem 1rem', fontSize: '.9rem', lineHeight: 1.4 }}>{error}</div>}

      {/* STOP PASSENGER BREAKDOWN ACCORDION */}
      <section className="card">
        <div
          onClick={() => setShowStopBreakdown(!showStopBreakdown)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <MapPin size={18} color="#06b6d4" />
            <h2 style={{ fontSize: '1.1rem', margin: 0 }}>
              15 Route 4 Stops — Boarded & Alighting Passenger Counts
            </h2>
          </div>
          <button type="button" style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            {showStopBreakdown ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>

        {showStopBreakdown && (
          <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: '#94a3b8' }}>
                  <th style={{ textAlign: 'left', padding: '.6rem' }}>Stop #</th>
                  <th style={{ textAlign: 'left', padding: '.6rem' }}>Designated Stop Name</th>
                  <th style={{ textAlign: 'center', padding: '.6rem' }}>Boarded Passengers</th>
                  <th style={{ textAlign: 'center', padding: '.6rem' }}>Alighting Here (Now)</th>
                  <th style={{ textAlign: 'center', padding: '.6rem' }}>Total Alighted</th>
                </tr>
              </thead>
              <tbody>
                {ROUTE4_STOPS.map((stop, sIdx) => {
                  const stats = getStopStats(stop.name);
                  return (
                    <tr key={stop.id || sIdx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '.6rem' }}>
                        <span className="badge" style={{ backgroundColor: '#0284c7', color: '#fff', fontSize: '.75rem' }}>
                          Stop {sIdx + 1}
                        </span>
                      </td>
                      <td style={{ padding: '.6rem', fontWeight: 600 }}>{stop.name}</td>
                      <td style={{ padding: '.6rem', textAlign: 'center' }}>
                        <span style={{ fontWeight: 800, color: stats.boarded > 0 ? '#10b981' : '#64748b' }}>
                          ↑ {stats.boarded}
                        </span>
                      </td>
                      <td style={{ padding: '.6rem', textAlign: 'center' }}>
                        <span style={{ fontWeight: 800, color: stats.alighting > 0 ? '#ef4444' : '#64748b' }}>
                          ↓ {stats.alighting}
                        </span>
                      </td>
                      <td style={{ padding: '.6rem', textAlign: 'center', color: '#94a3b8' }}>
                        {stats.completedAlighted}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* DAILY PASSENGER REGISTER TABLE */}
      <section className="card" style={{ overflowX: 'auto' }}>
        <h2 style={{ fontSize: '1.1rem', display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.75rem' }}>
          <Users size={18} /> Daily Passenger Register & Seating Quotas
        </h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '950px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: '#94a3b8', fontSize: '.85rem' }}>
              {['Pass ID', 'Passenger Name', 'Category / Seat Quota', 'Boarding Stop', 'Destination Stop', 'Boarded At', 'Alighted At', 'Status', 'Action'].map((head) => (
                <th key={head} style={{ textAlign: 'left', padding: '.7rem' }}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {registry.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>
                  No passenger registrations for this trip yet. Scan commuter passes above to register passengers.
                </td>
              </tr>
            ) : (
              registry.map((journey, index) => {
                const passengerName = journey.passenger_name || journey.profiles?.full_name || journey.profiles?.email || 'Passenger';
                const passId = journey.qr_token && /^\d{6}-\d{5}$/.test(journey.qr_token)
                  ? journey.qr_token
                  : dailyIds[index];
                const category = journey.passenger_category || journey.profiles?.passenger_category || journey.category || 'Regular';
                const isPri = isPriorityCategory(category);

                return (
                  <tr key={journey.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', fontSize: '.88rem' }}>
                    <td style={{ padding: '.7rem', fontWeight: 700, color: '#38bdf8' }}>{passId}</td>
                    <td style={{ padding: '.7rem', fontWeight: 600 }}>{passengerName}</td>
                    <td style={{ padding: '.7rem' }}>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: isPri ? 'rgba(245, 158, 11, 0.2)' : 'rgba(6, 182, 212, 0.2)',
                          color: isPri ? '#fbbf24' : '#38bdf8',
                          border: `1px solid ${isPri ? '#f59e0b' : '#06b6d4'}`,
                          fontSize: '.75rem',
                          fontWeight: 700
                        }}
                      >
                        {category} ({isPri ? 'Priority /20' : 'Regular /30'})
                      </span>
                    </td>
                    <td style={{ padding: '.7rem' }}>{journey.origin_name || 'Stop 1'}</td>
                    <td style={{ padding: '.7rem', color: '#38bdf8' }}>{journey.destination_name || 'End Stop'}</td>
                    <td style={{ padding: '.7rem' }}>{timeLabel(journey.boarded_at)}</td>
                    <td style={{ padding: '.7rem' }}>{timeLabel(journey.alighted_at)}</td>
                    <td style={{ padding: '.7rem' }}>
                      <span
                        className={`badge ${journey.status === 'boarded' ? 'badge-success' : journey.status === 'completed' ? 'badge-secondary' : 'badge-warning'}`}
                        style={{ fontSize: '.75rem' }}
                      >
                        {journey.status === 'boarded' ? 'Onboard' : journey.status === 'completed' ? 'Alighted' : 'Planned'}
                      </span>
                    </td>
                    <td style={{ padding: '.7rem' }}>
                      {journey.status === 'planned' && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busyId === journey.id}
                          onClick={() => recordEvent(journey, 'board')}
                          style={{ padding: '.35rem .75rem', fontSize: '.8rem' }}
                        >
                          <CheckCircle size={13} /> Board
                        </button>
                      )}
                      {journey.status === 'boarded' && (
                        <button
                          type="button"
                          className="btn btn-warning"
                          disabled={busyId === journey.id}
                          onClick={() => recordEvent(journey, 'alight')}
                          style={{ padding: '.35rem .75rem', fontSize: '.8rem' }}
                        >
                          Alight
                        </button>
                      )}
                      {journey.status === 'completed' && <span style={{ color: '#10b981', fontWeight: 700 }}>✓ Alighted</span>}
                      {journey.status === 'cancelled' && <span style={{ color: '#ef4444' }}>Cancelled</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
