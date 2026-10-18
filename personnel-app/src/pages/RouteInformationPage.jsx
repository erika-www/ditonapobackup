/**
 * RouteInformationPage Component (React / JSX)
 * Bus Admin / Conductor live route information dashboard featuring:
 * - Direction-dependent stop arrangement with Northbound/Southbound controls
 * - Real-time seat availability (/20 Priority vs /30 Regular)
 * - Live QR scanner integration (camera + manual) assessing category & updating stop passenger counts
 * - Per-stop boarded & alighting counters across all 15 Route 4 stops
 * - Automatic GPS arrival detection triggering manual registration
 */
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  fetchConfiguredRoute4Stops,
  fetchOngoingTripForBus,
  fetchPassengerRegistry,
  createManualPassengerJourney,
  recordBoardingEvent,
  fetchJourneyByQrToken,
  publishCurrentBusLocation
} from '../services/supabaseClient';
import { ROUTE4_STOPS, SOUTHBOUND_ROUTE4_STOPS, applyRoute4CoordinateOverrides } from '@shared/route4Stops';
import { parsePassengerQRCode, isPriorityCategory } from '@shared/qrPassUtils';
import { QrCameraScannerModal } from '../components/QrCameraScannerModal';
import {
  Users, MapPin, ArrowUp, ArrowDown, Play, Pause,
  RotateCcw, AlertCircle, Camera, ShieldCheck, UserCheck
} from 'lucide-react';

export function RouteInformationPage() {
  const { dutySession, updateDutySession, locationPermission, requestLocationPermission, isTestMode } = useAuth();

  // Current Live Time & Date Today (Hours and Minutes ONLY)
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Direction State (Northbound vs Southbound)
  const [direction, setDirection] = useState(dutySession.tripDirection || 'Northbound');
  const [routeStops, setRouteStops] = useState(ROUTE4_STOPS);

  // Dynamic Stops list according to direction
  const [stopsList, setStopsList] = useState(direction === 'Southbound' ? SOUTHBOUND_ROUTE4_STOPS : routeStops);

  useEffect(() => {
    let mounted = true;
    fetchConfiguredRoute4Stops().then((result) => {
      if (mounted && result.success && result.data.length) {
        setRouteStops(result.data.slice(0, 15));
      }
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const orderedStops = applyRoute4CoordinateOverrides(
      direction === 'Southbound' ? routeStops.filter((stop) => stop.id !== 'stop-9').reverse() : routeStops,
      direction
    );
    setStopsList(orderedStops.slice(0, 15).map((stop, idx) => ({
      ...stop,
      stopNumber: idx + 1,
      id: direction === 'Southbound' ? `sb-stop-${idx + 1}` : `stop-${idx + 1}`
    })));
  }, [direction, routeStops]);

  // Current stop index & Trip movement state
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [isTripActive, setIsTripActive] = useState(Boolean(dutySession.tripId));
  const [tripCount, setTripCount] = useState(1);
  const [statusMessage, setStatusMessage] = useState(null);
  const testRegistryKey = `qcbus_test_registry_${dutySession.tripId || 'local'}_${new Date().toISOString().slice(0, 10)}`;
  const tripSegmentKey = `${testRegistryKey}_started_at`;
  const [tripSegmentStartedAt, setTripSegmentStartedAt] = useState(() => Number(localStorage.getItem(tripSegmentKey)) || 0);
  const [passengerRegistry, setPassengerRegistry] = useState(() => {
    try { return JSON.parse(localStorage.getItem(testRegistryKey) || '[]'); } catch { return []; }
  });
  const [operationalTripId, setOperationalTripId] = useState(dutySession.tripId || null);

  // Manual Registration State
  const [showManualRegistration, setShowManualRegistration] = useState(false);
  const [manualPassengerName, setManualPassengerName] = useState('');
  const [manualPassengerCategory, setManualPassengerCategory] = useState('Regular');
  const [manualDestination, setManualDestination] = useState('');
  const [manualRegistrationBusy, setManualRegistrationBusy] = useState(false);

  // Camera QR Scanner State
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refreshRegistry = async () => {
      let tripId = null;
      if (dutySession.plateNumber) {
        const trip = await fetchOngoingTripForBus(dutySession.plateNumber);
        tripId = trip.success ? trip.data?.id : null;
      }
      tripId = tripId || dutySession.tripId || operationalTripId;
      if (!tripId) return;
      const result = await fetchPassengerRegistry(tripId);
      if (!cancelled && result.success && !isTestMode) {
        setOperationalTripId(tripId);
        setPassengerRegistry(tripSegmentStartedAt
          ? result.data.filter((journey) => new Date(journey.created_at || journey.boarded_at || 0).getTime() >= tripSegmentStartedAt)
          : result.data);
      }
    };
    refreshRegistry();
    const timer = setInterval(refreshRegistry, 4000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [dutySession.tripId, dutySession.plateNumber, operationalTripId, isTestMode, tripSegmentStartedAt]);

  useEffect(() => {
    if (isTestMode) localStorage.setItem(testRegistryKey, JSON.stringify(passengerRegistry));
  }, [isTestMode, passengerRegistry, testRegistryKey]);

  const currentStop = stopsList[currentStopIndex] || stopsList[0];
  const normalizeStopName = (name) => String(name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

  // Calculate Priority vs Regular Seat Quotas (20 Priority, 30 Regular = 50 total)
  const priorityBoarded = passengerRegistry.filter((journey) => (
    journey.status === 'boarded' && isPriorityCategory(journey.passenger_category || journey.profiles?.passenger_category || journey.category)
  )).reduce((acc, curr) => acc + (Number(curr.count) || 1), 0);

  const regularBoarded = passengerRegistry.filter((journey) => (
    journey.status === 'boarded' && !isPriorityCategory(journey.passenger_category || journey.profiles?.passenger_category || journey.category)
  )).reduce((acc, curr) => acc + (Number(curr.count) || 1), 0);

  const busCapacity = Number(dutySession.busCapacity) || 50;
  const prioritySeatCapacity = Math.min(20, busCapacity);
  const regularSeatCapacity = Math.max(0, busCapacity - prioritySeatCapacity);
  const availablePrioritySeats = Math.max(0, prioritySeatCapacity - priorityBoarded);
  const availableRegularSeats = Math.max(0, regularSeatCapacity - regularBoarded);
  const totalOnboard = priorityBoarded + regularBoarded;

  // Boarded & Alighting counters per stop
  const passengersBoardedAt = (stopName) => {
    const norm = normalizeStopName(stopName);
    return passengerRegistry.filter((journey) => (
      (journey.status === 'boarded' || journey.status === 'completed') && normalizeStopName(journey.origin_name) === norm
    )).reduce((acc, curr) => acc + (Number(curr.count) || 1), 0);
  };

  const passengersAlightingAt = (stopName) => {
    const norm = normalizeStopName(stopName);
    return passengerRegistry.filter((journey) => (
      journey.status === 'boarded' && normalizeStopName(journey.destination_name) === norm
    )).reduce((acc, curr) => acc + (Number(curr.count) || 1), 0);
  };

  // Match GPS fixes against every stop so missed or out-of-order arrivals can recover.
  const lastTriggeredStopRef = useRef(null);

  const triggerArrivalAtStop = (stopIdx) => {
    if (stopIdx < 0 || stopIdx >= stopsList.length) return;
    const targetStop = stopsList[stopIdx];
    setCurrentStopIndex(stopIdx);
    setShowManualRegistration(true);
    setManualDestination(stopsList[stopIdx + 1]?.name || '');
    setStatusMessage(`📍 Bus arrived at Stop ${stopIdx + 1} (${targetStop.name}). Manual passenger registration opened.`);
    lastTriggeredStopRef.current = targetStop.id || stopIdx;
  };

  useEffect(() => {
    if (!isTripActive || !navigator.geolocation) return undefined;
    let cancelled = false;
    let busId = null;
    let locationPublishWarningShown = false;

    if (!isTestMode && dutySession.plateNumber) {
      fetchOngoingTripForBus(dutySession.plateNumber).then((result) => {
        if (cancelled) return;
        if (result.success && result.data?.bus_id) {
          busId = result.data.bus_id;
          return;
        }
        setStatusMessage(result.success
          ? 'Live GPS is not being shared: no ongoing trip is assigned to this bus.'
          : `Live GPS could not be shared: ${result.error}`);
      });
    }

    const watchId = navigator.geolocation.watchPosition((position) => {
      const pLat = position.coords.latitude;
      const pLng = position.coords.longitude;
      if (busId && !isTestMode) {
        publishCurrentBusLocation(busId, {
          latitude: pLat,
          longitude: pLng,
          speed: position.coords.speed == null ? null : position.coords.speed * 3.6,
          heading: position.coords.heading,
          accuracy: position.coords.accuracy
        }).then((result) => {
          if (cancelled || result.success || locationPublishWarningShown) return;
          locationPublishWarningShown = true;
          setStatusMessage(`Live GPS could not be shared: ${result.error}`);
        });
      }

      const toRadians = (degrees) => degrees * Math.PI / 180;
      const gpsAccuracyMeters = Number(position.coords.accuracy);
      const arrivalRadiusMeters = Number.isFinite(gpsAccuracyMeters)
        ? Math.max(250, Math.min(gpsAccuracyMeters, 300))
        : 250;
      let arrivalStopIndex = -1;
      let closestDistanceMeters = Infinity;

      for (let index = 0; index < stopsList.length; index += 1) {
        const stopLat = Number(stopsList[index].lat);
        const stopLng = Number(stopsList[index].lng);
        if (!Number.isFinite(stopLat) || !Number.isFinite(stopLng)) continue;

        const latDelta = toRadians(stopLat - pLat);
        const lngDelta = toRadians(stopLng - pLng);
        const haversine = Math.sin(latDelta / 2) ** 2
          + Math.cos(toRadians(pLat)) * Math.cos(toRadians(stopLat)) * Math.sin(lngDelta / 2) ** 2;
        const distanceMeters = 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

        if (distanceMeters <= arrivalRadiusMeters && distanceMeters < closestDistanceMeters) {
          arrivalStopIndex = index;
          closestDistanceMeters = distanceMeters;
        }
      }

      if (arrivalStopIndex < 0) return;
      const arrivalStopKey = stopsList[arrivalStopIndex].id || arrivalStopIndex;
      if (lastTriggeredStopRef.current !== arrivalStopKey) {
        lastTriggeredStopRef.current = arrivalStopKey;
        triggerArrivalAtStop(arrivalStopIndex);
      }
    }, (error) => setStatusMessage(`Waiting for bus location: ${error.message}`), {
      enableHighAccuracy: true, maximumAge: 3000, timeout: 15000
    });
    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isTripActive, currentStopIndex, stopsList, dutySession.plateNumber, isTestMode]);

  // QR Code Processing from Camera Scanner or Gun
  const handleQrScan = async (rawCode) => {
    const raw = String(rawCode || '').trim();
    if (!raw) return;

    const parsed = parsePassengerQRCode(raw);
    const token = parsed?.tripId || raw.match(/(?:Code|Journey ID|Pass ID):\s*([^\r\n]+)/i)?.[1]?.trim() || raw;

    const effectiveTripId = operationalTripId || dutySession?.tripId || 'operational-trip';
    const found = await fetchJourneyByQrToken(token || raw);

    if (!found.success || !found.data) {
      setStatusMessage(`QR Scan Alert: ${found.error || 'Pass not recognized.'}`);
      return;
    }

    const savedTestJourney = passengerRegistry.find((row) => row.qr_token === token || row.id === found.data.id);
    const journey = savedTestJourney ? { ...found.data, ...savedTestJourney } : found.data;
    const nextEventType = journey.status === 'boarded' ? 'alight' : 'board';
    const isPri = isPriorityCategory(journey.passenger_category || journey.profiles?.passenger_category || journey.category);
    const cat = journey.passenger_category || journey.profiles?.passenger_category || journey.category || 'Regular';

    if (isTestMode) {
      const count = Math.max(1, Number(journey.count || parsed?.count) || 1);
      const capacity = busCapacity;
      if (nextEventType === 'board' && totalOnboard + count > capacity) {
        setStatusMessage(`Boarding rejected: ${count} passengers requested, but only ${Math.max(0, capacity - totalOnboard)} seats are available.`);
        return;
      }
      const categoryAvailable = isPri ? availablePrioritySeats : availableRegularSeats;
      if (nextEventType === 'board' && count > categoryAvailable) {
        setStatusMessage(`Boarding rejected: only ${categoryAvailable} ${isPri ? 'priority' : 'regular'} seat${categoryAvailable === 1 ? '' : 's'} are available.`);
        return;
      }
      const updatedJourney = {
        ...journey,
        id: journey.id || token,
        qr_token: token,
        count,
        passenger_category: cat,
        passenger_name: journey.passenger_name || 'Anonymous Passenger',
        origin_name: journey.origin_name || parsed?.boardingStop || currentStop.name,
        destination_name: journey.destination_name || parsed?.destinationStop || currentStop.name,
        status: nextEventType === 'board' ? 'boarded' : 'completed'
      };
      setPassengerRegistry((rows) => {
        const exists = rows.some((row) => row.qr_token === token || row.id === updatedJourney.id);
        return exists
          ? rows.map((row) => row.qr_token === token || row.id === updatedJourney.id ? updatedJourney : row)
          : [...rows, updatedJourney];
      });
      setStatusMessage(nextEventType === 'board'
        ? `Passenger boarded: ${count} passenger${count === 1 ? '' : 's'} (${cat}). ${Math.max(0, capacity - totalOnboard - count)} seats available.`
        : `Passenger alighted: ${count} seat${count === 1 ? '' : 's'} restored at ${currentStop.name}.`);
      return;
    }

    const result = await recordBoardingEvent({
      tripId: effectiveTripId,
      eventType: nextEventType,
      method: 'qr',
      passengerId: journey.passenger_id || null,
      journeyId: journey.id,
      idempotencyKey: `qr-${journey.id}-${nextEventType}-${Date.now()}`
    });

    if (!result.success) {
      setStatusMessage(`Scan recorded with notice: ${result.error}`);
    } else {
      if (nextEventType === 'board') {
        const remainingPriority = isPri ? Math.max(0, availablePrioritySeats - 1) : availablePrioritySeats;
        const remainingRegular = !isPri ? Math.max(0, availableRegularSeats - 1) : availableRegularSeats;
        setStatusMessage(
          `✓ PASSENGER BOARDED: ${journey.passenger_name || 'Passenger'} (${cat} · ${isPri ? `Priority /${prioritySeatCapacity}` : `Regular /${regularSeatCapacity}`}). Decremented ${isPri ? `Priority Seats (${remainingPriority}/${prioritySeatCapacity})` : `Regular Seats (${remainingRegular}/${regularSeatCapacity})`}. Boarding: ${journey.origin_name || currentStop.name} → Alights: ${journey.destination_name || 'Destination'}.`
        );
      } else {
        setStatusMessage(`✓ PASSENGER ALIGHTED: ${journey.passenger_name || 'Passenger'} alighted at ${journey.destination_name || currentStop.name}. Seat restored.`);
      }
    }

    // Refresh passenger registry
    if (operationalTripId) {
      const reg = await fetchPassengerRegistry(operationalTripId);
      if (reg.success) setPassengerRegistry(tripSegmentStartedAt
        ? reg.data.filter((row) => new Date(row.created_at || row.boarded_at || 0).getTime() >= tripSegmentStartedAt)
        : reg.data);
    }
  };

  // Start / Restart Another Trip Handler
  const handleStartAnotherTrip = () => {
    if (!operationalTripId) {
      setStatusMessage('No active database trip is assigned to this bus. Start an assigned trip before boarding passengers.');
      return;
    }
    const segmentStartedAt = Date.now();
    localStorage.setItem(tripSegmentKey, String(segmentStartedAt));
    setTripSegmentStartedAt(segmentStartedAt);
    setPassengerRegistry([]);
    lastTriggeredStopRef.current = null;
    setCurrentStopIndex(0);
    setIsTripActive(true);
    setTripCount((prev) => prev + 1);
    setShowManualRegistration(true);
    setManualDestination(stopsList[1]?.name || '');
    setStatusMessage(null);
    setStatusMessage(`Trip #${tripCount + 1} (${direction}) started at ${stopsList[0].name}.`);
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleManualRegistration = async (event) => {
    event.preventDefault();
    if (!manualPassengerName.trim() || !manualDestination) return;
    setManualRegistrationBusy(true);

    if (isTestMode) {
      const capacity = busCapacity;
      if (totalOnboard >= capacity) {
        setStatusMessage('Passenger registration failed: The bus has no available seats.');
        setManualRegistrationBusy(false);
        return;
      }
      if ((isPriorityCategory(manualPassengerCategory) ? availablePrioritySeats : availableRegularSeats) <= 0) {
        setStatusMessage(`Passenger registration failed: No ${isPriorityCategory(manualPassengerCategory) ? 'priority' : 'regular'} seats are available.`);
        setManualRegistrationBusy(false);
        return;
      }
      const testPassenger = {
        id: `test-${crypto.randomUUID()}`,
        passenger_name: manualPassengerName.trim(),
        passenger_category: manualPassengerCategory,
        origin_name: currentStop.name,
        destination_name: manualDestination,
        count: 1,
        status: 'boarded',
        boarded_at: new Date().toISOString()
      };
      setPassengerRegistry((rows) => [...rows, testPassenger]);
      setStatusMessage(`Passenger boarded at ${currentStop.name}. ${Math.max(0, capacity - totalOnboard - 1)} seats available; destination: ${manualDestination}.`);
      setManualPassengerName('');
      setShowManualRegistration(false);
      setManualRegistrationBusy(false);
      return;
    }

    let activeTripId = operationalTripId;
    if (dutySession.plateNumber) {
      const ongoing = await fetchOngoingTripForBus(dutySession.plateNumber);
      activeTripId = ongoing.success ? ongoing.data?.id : null;
    }
    if (!activeTripId) {
      setStatusMessage('Passenger registration failed: No ongoing trip is assigned to this bus. Start or resume the bus trip first.');
      setManualRegistrationBusy(false);
      return;
    }
    setOperationalTripId(activeTripId);

    const isPri = isPriorityCategory(manualPassengerCategory);
    const created = await createManualPassengerJourney({
      passengerName: `${manualPassengerName} (${manualPassengerCategory})`,
      origin: currentStop.name,
      destination: manualDestination,
      tripId: activeTripId
    });

    if (!created.success) {
      setStatusMessage(`Passenger registration failed: ${created.error}`);
      setManualRegistrationBusy(false);
      return;
    }

    const eventResult = await recordBoardingEvent({
      tripId: activeTripId,
      eventType: 'board',
      method: 'dashboard',
      journeyId: created.data.id,
      idempotencyKey: `manual-${created.data.id}`
    });

    if (!eventResult.success) {
      setStatusMessage(`Passenger registered with notice: ${eventResult.error}`);
    } else {
      setPassengerRegistry((rows) => [
        ...rows,
        {
          ...created.data,
          passenger_category: manualPassengerCategory,
          status: 'boarded',
          boarded_at: new Date().toISOString()
        }
      ]);
      const remainingPriority = isPri ? Math.max(0, availablePrioritySeats - 1) : availablePrioritySeats;
      const remainingRegular = !isPri ? Math.max(0, availableRegularSeats - 1) : availableRegularSeats;
      setStatusMessage(
        `✓ ${manualPassengerName.trim()} (${manualPassengerCategory}) boarded at ${currentStop.name}. Decremented ${isPri ? `Priority Seats (${remainingPriority}/${prioritySeatCapacity})` : `Regular Seats (${remainingRegular}/${regularSeatCapacity})`}. Destination: ${manualDestination}.`
      );
      setManualPassengerName('');
      setShowManualRegistration(false);
    }
    setManualRegistrationBusy(false);
  };

  const handleDirectionToggle = (newDir) => {
    lastTriggeredStopRef.current = null;
    setDirection(newDir);
    setCurrentStopIndex(0);
    setIsTripActive(false);
    updateDutySession({ tripDirection: newDir });
    setStatusMessage(`Direction updated to ${newDir}. Click "Start Trip" to begin.`);
  };

  // Format Time: Hours and Minutes ONLY (e.g. "10:30 AM")
  const timeFormatted = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit'
  });

  // Format Date Today (e.g. "Wed, Oct 15, 2026")
  const dateFormatted = currentTime.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 2rem)', gap: '0.75rem', boxSizing: 'border-box' }}>
      {/* Camera QR Scanner Modal */}
      <QrCameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={handleQrScan}
        title="Scan Commuter Digital QR Pass"
      />

      {/* Location Permission Prompt Banner */}
      {locationPermission === false && (
        <div style={{
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          padding: '0.5rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#f87171',
          fontSize: '0.82rem',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertCircle size={16} color="#ef4444" />
            <span>Location permission required to pinpoint vehicle position.</span>
          </div>
          <button type="button" onClick={requestLocationPermission} className="btn btn-primary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>
            Enable
          </button>
        </div>
      )}

      {/* TOP METRICS BAR */}
      <div className="card" style={{ padding: '0.75rem 1rem', flexShrink: 0, backgroundColor: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Driver & Unit Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className={`badge ${isTripActive ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}>
                  {isTripActive ? <><span className="pulse-dot"></span> TRIP #{tripCount} IN PROGRESS</> : `IDLE (TRIP #${tripCount})`}
                </span>
                <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>QC Bus Route 4</strong>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                Driver: <strong>{dutySession.driverName}</strong> ({dutySession.driverId}) | Unit: <strong>{dutySession.plateNumber || 'QC-BUS'}</strong>
              </div>
            </div>

            {/* NORTHBOUND & SOUTHBOUND OPTIONS & QR SCANNER BUTTON */}
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'var(--bg-subtle)', padding: '0.2rem', borderRadius: '6px', border: '1px solid var(--border-color)', width: 'fit-content' }}>
                <button
                  type="button"
                  onClick={() => handleDirectionToggle('Northbound')}
                  className={`btn ${direction === 'Northbound' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.2rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  Northbound <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDirectionToggle('Southbound')}
                  className={`btn ${direction === 'Southbound' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.2rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  Southbound <ArrowDown size={12} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="btn btn-primary"
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#0284c7' }}
              >
                <Camera size={13} /> Scan QR Pass
              </button>
            </div>
          </div>

          {/* Real-time Summary Counters: Available Priority, Regular, Total Onboard */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {/* Priority Seats Available */}
            <div style={{ textAlign: 'center', padding: '0.3rem 0.6rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', borderRadius: '6px', minWidth: '105px' }}>
              <span style={{ fontSize: '0.68rem', color: '#fbbf24', fontWeight: 700, display: 'block' }}>PRIORITY SEATS</span>
              <strong style={{ fontSize: '1.15rem', color: '#fef08a', fontVariantNumeric: 'tabular-nums' }}>
                {availablePrioritySeats} <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>/ {prioritySeatCapacity}</span>
              </strong>
            </div>

            {/* Regular Seats Available */}
            <div style={{ textAlign: 'center', padding: '0.3rem 0.6rem', backgroundColor: 'rgba(6, 182, 212, 0.1)', border: '1px solid #06b6d4', borderRadius: '6px', minWidth: '105px' }}>
              <span style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 700, display: 'block' }}>REGULAR SEATS</span>
              <strong style={{ fontSize: '1.15rem', color: '#e0f2fe', fontVariantNumeric: 'tabular-nums' }}>
                {availableRegularSeats} <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>/ {regularSeatCapacity}</span>
              </strong>
            </div>

            {/* Total Onboard */}
            <div style={{ textAlign: 'center', minWidth: '90px' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>ONBOARD</span>
              <strong style={{ fontSize: '1.25rem', color: '#10b981', fontVariantNumeric: 'tabular-nums' }}>
                {totalOnboard} <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>/ {busCapacity}</span>
              </strong>
            </div>

            {/* Current Stop */}
            <div style={{ textAlign: 'center', minWidth: '95px' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>CURRENT STOP</span>
              <strong style={{ fontSize: '0.95rem', color: '#06b6d4', fontVariantNumeric: 'tabular-nums' }}>
                Stop {currentStopIndex + 1}/{stopsList.length}
              </strong>
            </div>

            {/* Alighting at Next Stop */}
            <div style={{ textAlign: 'center', minWidth: '110px' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>ALIGHTING NEXT</span>
              <strong style={{ fontSize: '1.1rem', color: passengersAlightingAt(stopsList[currentStopIndex + 1]?.name) ? '#ef4444' : '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                {passengersAlightingAt(stopsList[currentStopIndex + 1]?.name) || '—'}{passengersAlightingAt(stopsList[currentStopIndex + 1]?.name) ? ' pax' : ''}
              </strong>
            </div>

            {/* Live Clock */}
            <div style={{
              textAlign: 'right',
              borderLeft: '1px solid var(--border-color)',
              paddingLeft: '0.85rem',
              minWidth: '130px'
            }}>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>
                {timeFormatted}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#06b6d4', fontVariantNumeric: 'tabular-nums' }}>
                {dateFormatted}
              </div>
            </div>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="alert alert-success" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', margin: 0, flexShrink: 0 }}>
          {statusMessage}
        </div>
      )}

      {/* MANUAL PASSENGER REGISTRATION MODAL */}
      {showManualRegistration && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.78)', display: 'grid', placeItems: 'center', zIndex: 1500, padding: '1rem' }}>
          <form className="card" onSubmit={handleManualRegistration} style={{ width: 'min(500px, 100%)', padding: '1.5rem', border: '2px solid #06b6d4', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <span className="badge badge-success" style={{ fontSize: '0.75rem', fontWeight: 800 }}>
                📍 BUS AT STOP {currentStopIndex + 1} OF 15
              </span>
              <button type="button" onClick={() => setShowManualRegistration(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.25rem', padding: '0 0.25rem' }}>×</button>
            </div>
            <h2 style={{ fontSize: '1.25rem', marginTop: 0, marginBottom: '0.25rem', color: 'var(--text-main)' }}>
              Manual Passenger Registration
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: '1.4' }}>
              Bus detected at Stop {currentStopIndex + 1}: <strong style={{ color: '#38bdf8' }}>{currentStop.name}</strong>
              <br />
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>GPS: {currentStop.lat?.toFixed(5)}, {currentStop.lng?.toFixed(5)}</span>
            </p>

            <label className="form-label" htmlFor="manual-passenger-name">Passenger Name / Identifier</label>
            <input
              id="manual-passenger-name"
              className="form-input"
              placeholder="e.g. Maria Santos (Walk-in)"
              value={manualPassengerName}
              onChange={(e) => setManualPassengerName(e.target.value)}
              required
              maxLength={120}
            />

            <label className="form-label" htmlFor="manual-passenger-category" style={{ marginTop: '.75rem' }}>
              Passenger Category (Determines /20 Priority vs /30 Regular Seating)
            </label>
            <select
              id="manual-passenger-category"
              className="form-select"
              value={manualPassengerCategory}
              onChange={(e) => setManualPassengerCategory(e.target.value)}
            >
              <option value="Regular">Regular Passenger (Non-Priority Seat /30)</option>
              <option value="Student">Student (Non-Priority Seat /30)</option>
              <option value="Senior Citizen">Senior Citizen (Priority Seat /20)</option>
              <option value="PWD">PWD - Person with Disability (Priority Seat /20)</option>
              <option value="Pregnant">Pregnant Passenger (Priority Seat /20)</option>
            </select>

            <label className="form-label" htmlFor="manual-passenger-destination" style={{ marginTop: '.75rem' }}>
              Destination Stop
            </label>
            <select
              id="manual-passenger-destination"
              className="form-select"
              value={manualDestination}
              onChange={(e) => setManualDestination(e.target.value)}
              required
            >
              <option value="">Select destination (Stops {currentStopIndex + 2} to 15)</option>
              {stopsList.slice(currentStopIndex + 1).map((stop, sIdx) => (
                <option key={stop.id || sIdx} value={stop.name}>
                  Stop {currentStopIndex + 2 + sIdx}: {stop.name}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: '.6rem', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowManualRegistration(false)}>Close / Skip</button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1, backgroundColor: '#06b6d4', borderColor: '#06b6d4' }}
                disabled={manualRegistrationBusy || !operationalTripId || !manualDestination}
              >
                {manualRegistrationBusy ? 'Registering…' : 'Confirm & Board Passenger'}
              </button>
            </div>
            {!operationalTripId && <p role="alert" style={{ color: '#f87171', marginTop: '0.75rem', fontSize: '0.8rem', marginBottom: 0 }}>Notice: Trip session in offline/standby mode.</p>}
          </form>
        </div>
      )}

      {/* MAIN ROUTE STOP SEQUENCE SECTION */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem', overflow: 'hidden', minHeight: '400px' }}>
        {/* Sequence Title & Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', flexShrink: 0, flexWrap: 'wrap', gap: '.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <MapPin size={20} color="#06b6d4" />
            <h2 style={{ fontSize: '1.15rem', margin: 0 }}>
              Route Stop Sequence ({direction} View: {direction === 'Northbound' ? 'QC Hall to Gen. Luis' : 'Gen. Luis to QC Hall'})
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setIsCameraOpen(true)}
              className="btn btn-primary"
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#0284c7' }}
            >
              <Camera size={14} /> Scan Pass
            </button>
            {isTripActive ? (
              <button
                type="button"
                onClick={() => setIsTripActive(false)}
                className="btn btn-secondary"
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <Pause size={14} /> Pause Trip
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartAnotherTrip}
                className="btn btn-primary"
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <Play size={14} /> Start Trip
              </button>
            )}
          </div>
        </div>

        {/* 15 STOPS DENSE GRID WITH BOARDED & ALIGHTING NUMBERS */}
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gridTemplateRows: 'repeat(3, 1fr)',
          gap: '0.65rem',
          height: '100%',
          overflowY: 'auto'
        }}>
          {stopsList.map((s, idx) => {
            const isCurrent = idx === currentStopIndex;
            const isPassed = idx < currentStopIndex;
            const boardedCount = passengersBoardedAt(s.name);
            const alightingCount = passengersAlightingAt(s.name);

            return (
              <div
                key={s.id || idx}
                onClick={() => triggerArrivalAtStop(idx)}
                title={`Click to set Bus at Stop ${idx + 1} and open manual passenger registration`}
                style={{
                  padding: '0.75rem',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  border: isCurrent ? '3px solid #10b981' : (isPassed ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid var(--border-color)'),
                  backgroundColor: isCurrent ? 'rgba(16, 185, 129, 0.25)' : (isPassed ? 'rgba(15, 23, 42, 0.55)' : 'var(--bg-card)'),
                  opacity: isPassed ? 0.65 : 1,
                  filter: isPassed ? 'grayscale(0.35)' : 'none',
                  transition: 'all 0.25s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: isCurrent ? '0 0 14px rgba(16, 185, 129, 0.4)' : 'none'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      backgroundColor: isCurrent ? '#10b981' : (isPassed ? '#475569' : '#0284c7'),
                      color: '#ffffff',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px'
                    }}>
                      STOP {idx + 1}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                      {s.lat?.toFixed(3)}, {s.lng?.toFixed(3)}
                    </span>
                  </div>
                  <div style={{
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    color: isCurrent ? '#34d399' : (isPassed ? '#94a3b8' : 'var(--text-main)'),
                    lineHeight: 1.35,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {s.name}
                  </div>
                </div>

                {/* BOARDED & ALIGHTING BADGES */}
                <div style={{ display: 'flex', gap: '.35rem', marginTop: '.45rem', flexWrap: 'wrap' }}>
                  {boardedCount > 0 && (
                    <span style={{ padding: '.15rem .35rem', borderRadius: '4px', background: 'rgba(16,185,129,.2)', border: '1px solid #10b981', color: '#34d399', fontSize: '.68rem', fontWeight: 700 }}>
                      ↑ {boardedCount} boarded
                    </span>
                  )}
                  {alightingCount > 0 && (
                    <span style={{ display: 'block', flexBasis: '100%', color: '#ef4444', fontSize: '.72rem', fontWeight: 800 }}>
                      Passengers Alighting: {alightingCount}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* BOTTOM QUICK CONTROLS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', paddingTop: '0.65rem', marginTop: '0.5rem', borderTop: '1px solid var(--border-color)', flexShrink: 0, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => triggerArrivalAtStop(currentStopIndex)}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: 'rgba(6, 182, 212, 0.15)', border: '1px solid #06b6d4', color: '#38bdf8' }}
          >
            <Users size={16} /> Register Passengers (Stop {currentStopIndex + 1})
          </button>

          {/* GPS arrivals open the manual registration popup automatically. */}

          <button
            type="button"
            onClick={handleStartAnotherTrip}
            className="btn btn-primary"
            style={{ justifyContent: 'center', padding: '0.45rem 1rem', fontSize: '0.88rem', fontWeight: 800, backgroundColor: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RotateCcw size={16} /> Start Another Trip
          </button>
        </div>
      </div>
    </div>
  );
}
