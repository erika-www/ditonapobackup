import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, RefreshCw, Users, ShieldCheck, UserCheck, AlertCircle, MapPin, ChevronDown, ChevronUp, Camera } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  supabase,
  fetchOngoingTripForBus,
  fetchPassengerRegistry,
  recordBoardingEvent,
  fetchTripOccupancy,
  fetchJourneyByQrToken
} from '../services/supabaseClient';
import { ROUTE4_STOPS, SOUTHBOUND_ROUTE4_STOPS, resolveRoute4Stop, validateTripDirection } from '@shared/route4Stops';
import { isPriorityCategory, parsePassengerQRCode } from '@shared/qrPassUtils';
import { QrCameraScannerModal } from '../components/QrCameraScannerModal';

const timeLabel = (value) => (value
  ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  : '—');

export function PassengerCheckInPage() {
  const { dutySession } = useAuth();
  const [tripId, setTripId] = useState(dutySession?.tripId || null);
  const [registry, setRegistry] = useState(() => {
    try {
      const plate = dutySession?.plateNumber || 'QC-BUS';
      const saved = localStorage.getItem(`qcbus_registry_${plate}`);
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });
  const [occupancy, setOccupancy] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [showStopBreakdown, setShowStopBreakdown] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const scannerBufferRef = useRef('');
  const scannerResetTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setError('');
    if (!dutySession?.plateNumber) {
      setError('No bus is assigned to this duty session.');
      return undefined;
    }
    fetchOngoingTripForBus(dutySession.plateNumber).then((result) => {
      if (cancelled) return;
      if (result.success && result.data?.id) setTripId(result.data.id);
    });
    return () => { cancelled = true; };
  }, [dutySession?.plateNumber]);

  const refresh = useCallback(async () => {
    if (!tripId) return;
    const [registryResult, occupancyResult] = await Promise.all([
      fetchPassengerRegistry(tripId),
      fetchTripOccupancy(tripId)
    ]);
    if (registryResult.success) {
      setRegistry((prevRows) => {
        const dbRows = registryResult.data || [];
        const statusRank = (status) => {
          const s = String(status || '').toLowerCase();
          if (s === 'completed' || s === 'alighted' || s === 'done') return 3;
          if (s === 'boarded' || s === 'onboard' || s === 'active') return 2;
          return 1;
        };

        const prevById = new Map();
        const prevByToken = new Map();
        (prevRows || []).forEach((row) => {
          if (row.id) prevById.set(String(row.id), row);
          if (row.qr_token) prevByToken.set(String(row.qr_token), row);
        });

        const mergedIds = new Set();
        const mergedTokens = new Set();

        const combined = dbRows.map((dbRow) => {
          const rowId = dbRow.id ? String(dbRow.id) : null;
          const rowToken = dbRow.qr_token ? String(dbRow.qr_token) : null;
          const localMatch = (rowId && prevById.get(rowId)) || (rowToken && prevByToken.get(rowToken));

          if (rowId) mergedIds.add(rowId);
          if (rowToken) mergedTokens.add(rowToken);

          if (localMatch) {
            const localRank = statusRank(localMatch.status);
            const dbRank = statusRank(dbRow.status);
            if (localRank > dbRank) {
              return {
                ...dbRow,
                ...localMatch,
                id: dbRow.id || localMatch.id,
                trip_id: dbRow.trip_id || localMatch.trip_id,
                status: localMatch.status,
                boarded_at: localMatch.boarded_at || dbRow.boarded_at,
                alighted_at: localMatch.alighted_at || dbRow.alighted_at,
                origin_name: localMatch.origin_name || dbRow.origin_name,
                destination_name: localMatch.destination_name || dbRow.destination_name,
                count: localMatch.count || Math.max(1, Number(dbRow.passenger_count) || 1)
              };
            }
            return {
              ...localMatch,
              ...dbRow,
              count: Math.max(1, Number(dbRow.count || dbRow.passenger_count || localMatch.count) || 1),
              origin_name: localMatch.origin_name || dbRow.origin_name,
              destination_name: localMatch.destination_name || dbRow.destination_name
            };
          }
          return {
            ...dbRow,
            count: Math.max(1, Number(dbRow.count || dbRow.passenger_count) || 1)
          };
        });

        (prevRows || []).forEach((row) => {
          const rId = row.id ? String(row.id) : null;
          const rToken = row.qr_token ? String(row.qr_token) : null;
          const inDb = (rId && mergedIds.has(rId)) || (rToken && mergedTokens.has(rToken));
          if (!inDb) {
            combined.push(row);
          }
        });

        try {
          const plate = dutySession?.plateNumber || 'QC-BUS';
          localStorage.setItem(`qcbus_registry_${plate}`, JSON.stringify(combined));
        } catch (_) {}
        return combined;
      });
    } else {
      setError(registryResult.error);
    }
    if (occupancyResult.success) setOccupancy(occupancyResult.data);
  }, [tripId, dutySession?.plateNumber]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [refresh]);

  // Helper to ensure virtual/soft keyboard is dismissed and stays closed
  const dismissSoftKeyboard = () => {
    if (typeof document !== 'undefined') {
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      if (window.getSelection) {
        window.getSelection()?.removeAllRanges();
      }
    }
  };

  // Total seat calculation: 20 Priority, 30 Regular = 50 total
  const priorityBoarded = registry.filter((j) => j.status === 'boarded').reduce((acc, curr) => {
    if (curr.priority_count != null) return acc + Number(curr.priority_count);
    const isPri = isPriorityCategory(curr.passenger_category || curr.profiles?.passenger_category || curr.category);
    return acc + (isPri ? (Number(curr.count) || 1) : 0);
  }, 0);

  const regularBoarded = registry.filter((j) => j.status === 'boarded').reduce((acc, curr) => {
    if (curr.regular_count != null) return acc + Number(curr.regular_count);
    const isPri = isPriorityCategory(curr.passenger_category || curr.profiles?.passenger_category || curr.category);
    return acc + (!isPri ? (Number(curr.count) || 1) : 0);
  }, 0);

  const availablePrioritySeats = Math.max(0, 20 - priorityBoarded);
  const availableRegularSeats = Math.max(0, 30 - regularBoarded);
  const totalOnboard = priorityBoarded + regularBoarded;

  // Stop statistics: boarded count at boarding stop, alighting count at destination stop
  const getStopStats = (stopName) => {
    const targetCanonical = resolveRoute4Stop(stopName)?.name || stopName;

    // Boarded count: incremented when passengers board at this stop
    const boarded = registry.filter((j) => {
      const isBoardedOrDone = j.status === 'boarded' || j.status === 'completed';
      const stopCanonical = resolveRoute4Stop(j.origin_name)?.name || j.origin_name;
      return isBoardedOrDone && stopCanonical === targetCanonical;
    }).reduce((acc, curr) => acc + (Number(curr.count) || 1), 0);

    // Alighting count: passengers currently onboard scheduled to alight at this stop
    const alighting = registry.filter((j) => {
      const isCurrentlyBoarded = j.status === 'boarded';
      const stopCanonical = resolveRoute4Stop(j.destination_name)?.name || j.destination_name;
      return isCurrentlyBoarded && stopCanonical === targetCanonical;
    }).reduce((acc, curr) => acc + (Number(curr.count) || 1), 0);

    // Completed alighted count: incremented when passengers have alighted at this stop
    const completedAlighted = registry.filter((j) => {
      const isCompleted = j.status === 'completed';
      const stopCanonical = resolveRoute4Stop(j.destination_name)?.name || j.destination_name;
      return isCompleted && stopCanonical === targetCanonical;
    }).reduce((acc, curr) => acc + (Number(curr.count) || 1), 0);

    return { boarded, alighting, completedAlighted };
  };

  const recordEvent = async (journey, eventType) => {
    setBusyId(journey.id);
    setError('');
    setNotice('');

    let effectiveTripId = tripId || dutySession?.tripId || null;
    if (!effectiveTripId && dutySession?.plateNumber) {
      const activeTrip = await fetchOngoingTripForBus(dutySession.plateNumber);
      effectiveTripId = activeTrip.success ? activeTrip.data?.id : null;
      if (effectiveTripId) setTripId(effectiveTripId);
    }
    if (!effectiveTripId) {
      setError('🔒 Trip not started. Please start the trip first.');
      setBusyId(null);
      dismissSoftKeyboard();
      return;
    }

    const isPri = isPriorityCategory(journey.passenger_category || journey.profiles?.passenger_category || journey.category);
    const catName = journey.passenger_category || journey.profiles?.passenger_category || journey.category || 'Regular';
    const passengerCount = Math.max(1, Number(journey.count || journey.passenger_count) || 1);

    const busDir = dutySession?.tripDirection || 'Northbound';
    // Resolve boarding and destination stops against canonical Route 4 stops
    const resolvedOrigin = resolveRoute4Stop(journey.parsed?.boardingStop || journey.origin_name, busDir) || (busDir === 'Southbound' ? SOUTHBOUND_ROUTE4_STOPS[0] : ROUTE4_STOPS[0]);
    const resolvedDestination = resolveRoute4Stop(journey.parsed?.destinationStop || journey.destination_name, busDir) || (busDir === 'Southbound' ? SOUTHBOUND_ROUTE4_STOPS[SOUTHBOUND_ROUTE4_STOPS.length - 1] : ROUTE4_STOPS[ROUTE4_STOPS.length - 1]);

    const result = await recordBoardingEvent({
      tripId: effectiveTripId,
      eventType,
      method: 'qr',
      passengerId: journey.passenger_id || null,
      journeyId: journey.id,
      busId: dutySession?.busId || null,
      idempotencyKey: `registry-${journey.id}-${eventType}-${Date.now()}`
    });

    if (!result.success) {
      setError(result.error);
    } else {
      const now = new Date().toISOString();
      const updatedJourney = {
        ...journey,
        trip_id: effectiveTripId,
        count: passengerCount,
        origin_name: resolvedOrigin.name,
        destination_name: resolvedDestination.name,
        status: eventType === 'board' ? 'boarded' : 'completed',
        boarded_at: eventType === 'board' ? (journey.boarded_at || now) : journey.boarded_at,
        alighted_at: eventType === 'alight' ? now : journey.alighted_at
      };

      // Immediately increment/decrement local state and persist to localStorage
      setRegistry((rows) => {
        const token = updatedJourney.qr_token || updatedJourney.id;
        const exists = rows.some((row) => row.id === updatedJourney.id || (row.qr_token && row.qr_token === token));
        const nextRows = exists
          ? rows.map((row) => (row.id === updatedJourney.id || (row.qr_token && row.qr_token === token)) ? { ...row, ...updatedJourney } : row)
          : [...rows, updatedJourney];
        try {
          const plate = dutySession?.plateNumber || 'QC-BUS';
          localStorage.setItem(`qcbus_registry_${plate}`, JSON.stringify(nextRows));
          localStorage.setItem(`qcbus_scanned_${token}`, JSON.stringify({ status: updatedJourney.status, scanned_at: now }));
          if (journey.id) {
            localStorage.setItem(`qcbus_scanned_${journey.id}`, JSON.stringify({ status: updatedJourney.status, scanned_at: now }));
          }

          // Shared cookie for cross-port localhost sync
          const cookiePayload = encodeURIComponent(JSON.stringify({
            status: updatedJourney.status,
            stop: resolvedOrigin.name,
            time: Date.now()
          }));
          document.cookie = `qcbus_scan_${token}=${cookiePayload}; path=/; max-age=86400`;
          if (journey.id) {
            document.cookie = `qcbus_scan_${journey.id}=${cookiePayload}; path=/; max-age=86400`;
          }

          const liveOcc = {
            bus_plate: plate,
            trip_id: effectiveTripId,
            direction: busDir,
            current_onboard: eventType === 'board' ? totalOnboard + passengerCount : Math.max(0, totalOnboard - passengerCount),
            bus_capacity: 50,
            available_seats: Math.max(0, 50 - (eventType === 'board' ? totalOnboard + passengerCount : Math.max(0, totalOnboard - passengerCount))),
            priority_boarded: eventType === 'board' ? (isPri ? priorityBoarded + passengerCount : priorityBoarded) : (isPri ? Math.max(0, priorityBoarded - passengerCount) : priorityBoarded),
            regular_boarded: eventType === 'board' ? (!isPri ? regularBoarded + passengerCount : regularBoarded) : (!isPri ? Math.max(0, regularBoarded - passengerCount) : regularBoarded),
            available_priority_seats: isPri ? (eventType === 'board' ? Math.max(0, availablePrioritySeats - passengerCount) : availablePrioritySeats + passengerCount) : availablePrioritySeats,
            available_regular_seats: !isPri ? (eventType === 'board' ? Math.max(0, availableRegularSeats - passengerCount) : availableRegularSeats + passengerCount) : availableRegularSeats,
            last_scanned_token: token,
            last_scanned_status: updatedJourney.status,
            updated_at: now
          };
          localStorage.setItem('qcbus_live_occupancy', JSON.stringify(liveOcc));
        } catch (_) {}
        return nextRows;
      });

      // Background update to Supabase passenger_journeys table
      try {
        const updateData = {
          status: updatedJourney.status,
          trip_id: effectiveTripId,
          origin_name: resolvedOrigin.name,
          destination_name: resolvedDestination.name,
          boarded_at: updatedJourney.boarded_at,
          alighted_at: updatedJourney.alighted_at,
          updated_at: now
        };
        const token = updatedJourney.qr_token || updatedJourney.id;
        const isUuid = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(str || ''));
        if (journey.id && isUuid(journey.id)) {
          supabase.from('passenger_journeys').update(updateData).eq('id', journey.id).then(({ error }) => {
            if (error && token) {
              supabase.from('passenger_journeys').update(updateData).eq('qr_token', token).catch(() => {});
            }
          }).catch(() => {});
        } else if (token) {
          supabase.from('passenger_journeys').update(updateData).eq('qr_token', token).catch(() => {});
        }
      } catch (_) {}

      if (eventType === 'board') {
        const remainingPriority = isPri ? Math.max(0, availablePrioritySeats - passengerCount) : availablePrioritySeats;
        const remainingRegular = !isPri ? Math.max(0, availableRegularSeats - passengerCount) : availableRegularSeats;
        const newTotal = totalOnboard + passengerCount;
        setNotice(
          `✓ ${passengerCount} PASSENGER${passengerCount === 1 ? '' : 'S'} BOARDED (${catName}). Total Onboard: ${newTotal}/50. Remaining Seats: ${remainingPriority} Priority / ${remainingRegular} Regular. Boarded at: ${resolvedOrigin.name} → Destination: ${resolvedDestination.name}.`
        );
      } else {
        const newTotal = Math.max(0, totalOnboard - passengerCount);
        setNotice(
          `✓ ${passengerCount} PASSENGER${passengerCount === 1 ? '' : 'S'} ALIGHTED at ${resolvedDestination.name}. ${passengerCount} seat${passengerCount === 1 ? '' : 's'} freed. Total Onboard: ${newTotal}/50.`
        );
      }
    }

    dismissSoftKeyboard();
    setTimeout(dismissSoftKeyboard, 50);
    await refresh();
    setBusyId(null);
  };

  const processScannedCode = async (rawCode) => {
    const raw = String(rawCode || '').trim();
    if (!raw) return;
    setError('');
    setNotice('');

    dismissSoftKeyboard();
    setTimeout(dismissSoftKeyboard, 50);

    // Check if trip is active before allowing scanning
    let effectiveTripId = tripId || dutySession?.tripId || null;
    if (!effectiveTripId && dutySession?.plateNumber) {
      const activeTrip = await fetchOngoingTripForBus(dutySession.plateNumber);
      effectiveTripId = activeTrip.success ? activeTrip.data?.id : null;
      if (effectiveTripId) setTripId(effectiveTripId);
    }
    if (!effectiveTripId) {
      setError('🔒 Scanner locked: Trip is not started. Please click "Start Trip" before scanning.');
      dismissSoftKeyboard();
      return;
    }

    // 1. Extract pass data from the QR
    const found = await fetchJourneyByQrToken(raw);
    if (!found.success || !found.data) {
      setError(found.error || 'QR pass was not recognized or found in registry.');
      dismissSoftKeyboard();
      return;
    }

    const journey = found.data;
    const token = journey.qr_token || journey.id;
    const parsed = parsePassengerQRCode(raw);

    // Direction validation
    const currentBusDir = dutySession?.tripDirection || 'Northbound';

    // Resolve boarding & destination stops
    const resolvedOrigin = resolveRoute4Stop(parsed?.boardingStop || journey.origin_name, currentBusDir) || (currentBusDir === 'Southbound' ? SOUTHBOUND_ROUTE4_STOPS[0] : ROUTE4_STOPS[0]);
    const resolvedDestination = resolveRoute4Stop(parsed?.destinationStop || journey.destination_name, currentBusDir) || (currentBusDir === 'Southbound' ? SOUTHBOUND_ROUTE4_STOPS[SOUTHBOUND_ROUTE4_STOPS.length - 1] : ROUTE4_STOPS[ROUTE4_STOPS.length - 1]);

    const passengerDir = parsed?.direction || journey.route_direction || journey.direction;
    const dirValidation = validateTripDirection(passengerDir, resolvedOrigin, resolvedDestination, currentBusDir);
    if (!dirValidation.valid) {
      setError('trip error: wrong way');
      dismissSoftKeyboard();
      return;
    }

    // 2. Analyze state: if already boarded, toggle to alight; otherwise board
    const existing = registry.find((j) => (j.qr_token && j.qr_token === token) || j.id === journey.id);
    const isCurrentlyBoarded = existing ? existing.status === 'boarded' : journey.status === 'boarded';
    const nextEventType = isCurrentlyBoarded ? 'alight' : 'board';

    await recordEvent({ ...journey, ...(existing || {}), parsed }, nextEventType);
  };

  // Keep a stable ref so event listener doesn't need to be recreated on every render
  const processScannedCodeRef = useRef(processScannedCode);
  useEffect(() => {
    processScannedCodeRef.current = processScannedCode;
  });

  // Capture hardware barcode / QR scanner keystrokes at window level.
  // Never focuses an input so the on-screen soft keyboard NEVER pops up.
  useEffect(() => {
    const onScannerKeyDown = (event) => {
      const target = event.target;
      const isEditable = target instanceof HTMLElement && (
        target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
      );
      if (isEditable || event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === 'Enter' || event.key === 'Tab') {
        const scannedValue = scannerBufferRef.current.trim();
        scannerBufferRef.current = '';
        window.clearTimeout(scannerResetTimerRef.current);
        if (scannedValue) {
          event.preventDefault();
          if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          processScannedCodeRef.current(scannedValue);
        }
        return;
      }

      if (event.key.length === 1) {
        scannerBufferRef.current += event.key;
        window.clearTimeout(scannerResetTimerRef.current);
        scannerResetTimerRef.current = window.setTimeout(() => {
          scannerBufferRef.current = '';
        }, 500);
      }
    };

    window.addEventListener('keydown', onScannerKeyDown);
    return () => {
      window.removeEventListener('keydown', onScannerKeyDown);
      window.clearTimeout(scannerResetTimerRef.current);
    };
  }, []);

  const dailyCounts = {};
  const dailyIds = registry.map((journey) => {
    const date = new Date(journey.created_at || Date.now()).toLocaleDateString();
    dailyCounts[date] = (dailyCounts[date] || 0) + 1;
    return `PAX-${String(dailyCounts[date]).padStart(3, '0')}`;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* CAMERA QR SCANNER MODAL (Zero keyboard popups) */}
      <QrCameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={processScannedCode}
        title="Scan Commuter QR Pass"
      />

      {/* TOP SUMMARY CARD */}
      <section className="card" style={{ background: '#123b3b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '.3rem' }}>Passenger Check-in & QR Operations</h1>
            <p style={{ color: '#94a3b8', margin: '.35rem 0 0' }}>
              Duty bus: <strong>{dutySession?.plateNumber || occupancy?.bus_plate || 'QC-BUS'}</strong> | Assigned Driver: <strong>{dutySession?.driverName}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => {
                const effectiveTripId = tripId || dutySession?.tripId;
                if (!effectiveTripId) {
                  setError('🔒 Scanner locked: Trip is not started. Please start the trip before scanning.');
                  dismissSoftKeyboard();
                  return;
                }
                if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
                setIsCameraOpen(true);
              }}
              disabled={!tripId && !dutySession?.tripId}
              className={`btn ${(tripId || dutySession?.tripId) ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                padding: '.45rem .85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '.4rem',
                backgroundColor: (tripId || dutySession?.tripId) ? '#0284c7' : 'var(--bg-subtle)',
                borderColor: (tripId || dutySession?.tripId) ? '#0284c7' : 'var(--border-color)',
                cursor: (tripId || dutySession?.tripId) ? 'pointer' : 'not-allowed',
                opacity: (tripId || dutySession?.tripId) ? 1 : 0.6
              }}
              title={(tripId || dutySession?.tripId) ? 'Open Camera Scanner' : 'Trip is not started'}
            >
              <Camera size={16} /> Open Camera Scanner
            </button>
            <div role="status" aria-label="QR scanner is ready" style={{ padding: '.45rem .6rem', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#94a3b8', fontSize: '.85rem' }}>
              Hardware scanner ready
            </div>
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
