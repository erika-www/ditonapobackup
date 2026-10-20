/**
 * RouteInformationPage Component (React / JSX)
 * Bus Admin / Conductor live route information dashboard featuring:
 * - Direction-dependent stop arrangement with Northbound/Southbound controls
 * - Real-time seat availability (/20 Priority vs /30 Regular)
 * - Live USB/RS232-TTL QR scanner integration assessing category & updating stop passenger counts
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
  publishCurrentBusLocation,
  startDutyTripForBus,
  startNextTrip,
  supabase
} from '../services/supabaseClient';
import {
  sendDirectionToBridge,
  endTripOnBridge,
  fetchBridgeStatus,
  fetchLatestBridgeGps
} from '../services/busAnnouncerBridge';
import { ROUTE4_STOPS, SOUTHBOUND_ROUTE4_STOPS, applyRoute4CoordinateOverrides, resolveRoute4Stop } from '@shared/route4Stops';
import { parsePassengerQRCode, isPriorityCategory } from '@shared/qrPassUtils';
import { QrCameraScannerModal } from '../components/QrCameraScannerModal';
import {
  Users, MapPin, ArrowUp, ArrowDown, Play, Pause,
  RotateCcw, ShieldCheck, UserCheck,
  Volume2, VolumeX, Camera
} from 'lucide-react';

export function RouteInformationPage() {
  const { dutySession, updateDutySession, isTestMode } = useAuth();
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Current Live Time & Date Today (Hours and Minutes ONLY)
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Direction State (Northbound vs Southbound)
  const [direction, setDirection] = useState(dutySession.tripDirection || 'Northbound');
  const [routeStops, setRouteStops] = useState(ROUTE4_STOPS);

  // Pi 3B Bus Announcer Connection State
  const [announcerInfo, setAnnouncerInfo] = useState({ online: false, checking: true, lastCheck: null });

  useEffect(() => {
    let active = true;
    const checkBridge = async () => {
      const res = await fetchBridgeStatus();
      if (active) {
        setAnnouncerInfo({ online: Boolean(res.online), checking: false, lastCheck: Date.now() });
      }
    };
    checkBridge();
    const timer = setInterval(checkBridge, 6000);
    return () => { active = false; clearInterval(timer); };
  }, []);

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
  const [isTripActive, setIsTripActive] = useState(false);
  const [tripCount, setTripCount] = useState(1);
  const [statusMessage, setStatusMessage] = useState(null);
  const testRegistryKey = `qcbus_test_registry_${dutySession.tripId || 'local'}_${new Date().toISOString().slice(0, 10)}`;
  const tripSegmentKey = `${testRegistryKey}_started_at`;
  const [tripSegmentStartedAt, setTripSegmentStartedAt] = useState(() => Number(localStorage.getItem(tripSegmentKey)) || 0);
  const [passengerRegistry, setPassengerRegistry] = useState(() => {
    try {
      const plate = dutySession?.plateNumber || 'QC-BUS';
      const key = isTestMode ? testRegistryKey : `qcbus_registry_${plate}`;
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [operationalTripId, setOperationalTripId] = useState(null);

  // Manual Registration State
  const [showManualRegistration, setShowManualRegistration] = useState(false);
  const [manualPassengerCategory, setManualPassengerCategory] = useState('Regular');
  const [manualPassengerCount, setManualPassengerCount] = useState(1);
  const [manualDestination, setManualDestination] = useState('');
  const [manualRegistrationBusy, setManualRegistrationBusy] = useState(false);
  const manualSubmissionRef = useRef(false);

  const scannerBufferRef = useRef('');
  const scannerResetTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const refreshRegistry = async () => {
      let tripId = null;
      if (dutySession.plateNumber) {
        const trip = await fetchOngoingTripForBus(dutySession.plateNumber);
        tripId = trip.success ? trip.data?.id : null;
      }
      if (!tripId) {
        if (!cancelled && !isTripActive && !dutySession.tripId) {
          setOperationalTripId(null);
        }
        return;
      }
      const result = await fetchPassengerRegistry(tripId);
      if (!cancelled && result.success) {
        setOperationalTripId(tripId);
        setPassengerRegistry((prevRows) => {
          const dbRows = result.data || [];
          const dbIds = new Set(dbRows.map((r) => r.id || r.qr_token));
          // Preserve any newly scanned local entries that haven't arrived via polling yet
          const localOnly = prevRows.filter((r) => !dbIds.has(r.id) && (!r.qr_token || !dbIds.has(r.qr_token)));
          const combined = [...dbRows, ...localOnly];
          try {
            const plate = dutySession?.plateNumber || 'QC-BUS';
            const key = isTestMode ? testRegistryKey : `qcbus_registry_${plate}`;
            localStorage.setItem(key, JSON.stringify(combined));
          } catch (_) {}
          return combined;
        });
      }
    };
    refreshRegistry();
    const timer = setInterval(refreshRegistry, 4000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [dutySession.tripId, dutySession.plateNumber, operationalTripId, isTestMode, tripSegmentStartedAt, isTripActive, testRegistryKey]);

  useEffect(() => {
    try {
      const plate = dutySession?.plateNumber || 'QC-BUS';
      const key = isTestMode ? testRegistryKey : `qcbus_registry_${plate}`;
      localStorage.setItem(key, JSON.stringify(passengerRegistry));
    } catch (_) {}
  }, [isTestMode, passengerRegistry, testRegistryKey, dutySession?.plateNumber]);

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

  // Boarded & Alighting counters per stop using canonical stop resolution
  const passengersBoardedAt = (stopName) => {
    const targetCanonical = resolveRoute4Stop(stopName)?.name || stopName;
    return passengerRegistry.filter((journey) => {
      const isBoardedOrDone = journey.status === 'boarded' || journey.status === 'completed';
      const stopCanonical = resolveRoute4Stop(journey.origin_name)?.name || journey.origin_name;
      return isBoardedOrDone && stopCanonical === targetCanonical;
    }).reduce((acc, curr) => acc + (Number(curr.count) || 1), 0);
  };

  const passengersAlightingAt = (stopName) => {
    const targetCanonical = resolveRoute4Stop(stopName)?.name || stopName;
    return passengerRegistry.filter((journey) => {
      const isCurrentlyBoarded = journey.status === 'boarded';
      const stopCanonical = resolveRoute4Stop(journey.destination_name)?.name || journey.destination_name;
      return isCurrentlyBoarded && stopCanonical === targetCanonical;
    }).reduce((acc, curr) => acc + (Number(curr.count) || 1), 0);
  };

  const passengersCompletedAlightedAt = (stopName) => {
    const targetCanonical = resolveRoute4Stop(stopName)?.name || stopName;
    return passengerRegistry.filter((journey) => {
      const isCompleted = journey.status === 'completed';
      const stopCanonical = resolveRoute4Stop(journey.destination_name)?.name || journey.destination_name;
      return isCompleted && stopCanonical === targetCanonical;
    }).reduce((acc, curr) => acc + (Number(curr.count) || 1), 0);
  };

  // Match GPS fixes against every stop so missed or out-of-order arrivals can recover.
  const lastTriggeredStopRef = useRef(null);
  const busIdRef = useRef(null);
  const ARRIVAL_RADIUS_METERS = 5; // 5-meter radius trigger for all stops & target destination

  const ensureOperationalTrip = async () => {
    if (dutySession.plateNumber) {
      const ongoing = await fetchOngoingTripForBus(dutySession.plateNumber);
      if (ongoing.success && ongoing.data?.id) {
        setOperationalTripId(ongoing.data.id);
        return ongoing.data.id;
      }
    }

    const started = await startDutyTripForBus({
      plateNumber: dutySession.plateNumber,
      busCapacity: dutySession.busCapacity || 50,
      driverPersonnelId: dutySession.driverPersonnelId,
      conductorPersonnelId: dutySession.conductorPersonnelId,
      dispatcherPersonnelId: dutySession.dispatcherPersonnelId
    });
    if (!started.success || !started.data?.trip?.id) {
      throw new Error(started.error || 'Unable to start an ongoing database trip.');
    }
    const tripId = started.data.trip.id;
    setOperationalTripId(tripId);
    updateDutySession({ tripId });
    return tripId;
  };

  const resolveBusId = async () => {
    if (busIdRef.current) return busIdRef.current;
    const plate = dutySession.plateNumber || 'QC-BUS-0402';

    // 1. Check ongoing trip
    try {
      const ongoing = await fetchOngoingTripForBus(plate);
      if (ongoing.success && ongoing.data?.bus_id) {
        busIdRef.current = ongoing.data.bus_id;
        if (ongoing.data.id && !operationalTripId) {
          setOperationalTripId(ongoing.data.id);
        }
        return ongoing.data.bus_id;
      }
    } catch (_) {}

    // 2. Check bus by plate number
    try {
      const { data: bus } = await supabase.from('buses')
        .select('id').eq('plate_number', plate).maybeSingle();
      if (bus?.id) {
        busIdRef.current = bus.id;
        return bus.id;
      }
    } catch (_) {}

    // 3. Ensure duty trip is started for bus
    try {
      const started = await startDutyTripForBus({
        plateNumber: plate,
        busCapacity: dutySession.busCapacity || 50,
        driverPersonnelId: dutySession.driverPersonnelId,
        conductorPersonnelId: dutySession.conductorPersonnelId,
        dispatcherPersonnelId: dutySession.dispatcherPersonnelId
      });
      if (started.success && started.data?.bus?.id) {
        busIdRef.current = started.data.bus.id;
        if (started.data.trip?.id) setOperationalTripId(started.data.trip.id);
        return started.data.bus.id;
      }
    } catch (_) {}

    // 4. Fallback to any active bus
    try {
      const { data: fallbackBus } = await supabase.from('buses')
        .select('id').eq('status', 'active').limit(1).maybeSingle();
      if (fallbackBus?.id) {
        busIdRef.current = fallbackBus.id;
        return fallbackBus.id;
      }
    } catch (_) {}

    return null;
  };

  // Helper to broadcast moving vehicle GPS to Supabase so passenger app updates in real-time
  const broadcastBusGps = async (latitude, longitude, speed, heading, accuracy) => {
    let bId = busIdRef.current;
    if (!bId) {
      bId = await resolveBusId();
    }
    if (!bId) return;

    return publishCurrentBusLocation(bId, {
      latitude,
      longitude,
      speed: speed == null ? null : speed,
      heading: heading == null ? null : heading,
      accuracy: accuracy == null ? null : accuracy
    });
  };

  const triggerArrivalAtStop = (stopIdx) => {
    if (stopIdx < 0 || stopIdx >= stopsList.length) return;
    const targetStop = stopsList[stopIdx];
    const isTargetDestination = stopIdx === stopsList.length - 1;
    setCurrentStopIndex(stopIdx);
    if (!isTripActive) {
      setStatusMessage('Start the trip before registering passengers at a stop.');
      return;
    }
    setShowManualRegistration(true);
    setManualDestination(stopsList[stopIdx + 1]?.name || '');
    setStatusMessage(isTargetDestination
      ? `🏁 TARGET DESTINATION REACHED: Stop ${stopIdx + 1} (${targetStop.name}) within 5m radius!`
      : `📍 Bus arrived at Stop ${stopIdx + 1} (${targetStop.name}) within 5m radius. Registration modal opened.`);
    lastTriggeredStopRef.current = targetStop.id || stopIdx;

    // Immediately reflect vehicle location at arrived stop to Supabase so passenger app live map & destination detector trigger
    if (Number.isFinite(Number(targetStop.lat)) && Number.isFinite(Number(targetStop.lng))) {
      broadcastBusGps(Number(targetStop.lat), Number(targetStop.lng), 0, null, 2);
    }
  };

  useEffect(() => {
    resolveBusId();
  }, [dutySession.plateNumber]);

  useEffect(() => {
    if (!isTripActive) return undefined;
    let cancelled = false;

    const toRadians = (degrees) => degrees * Math.PI / 180;

    // 1. Device GPS Watcher (temporarily bypassed). QR registration uses the
    // stops encoded in the pass and must work from any physical location.
    let watchId = null;
    const useDeviceGps = false;
    if (useDeviceGps && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition((position) => {
        const pLat = position.coords.latitude;
        const pLng = position.coords.longitude;
        const speedKmh = position.coords.speed == null ? null : position.coords.speed * 3.6;

        broadcastBusGps(pLat, pLng, speedKmh, position.coords.heading, position.coords.accuracy);

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

          if (distanceMeters <= ARRIVAL_RADIUS_METERS && distanceMeters < closestDistanceMeters) {
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
        enableHighAccuracy: true, maximumAge: 2000, timeout: 15000
      });
    }

    // 2. Hardware Bridge GPS Poller from Pi 3B / Pi 4B bridge
    const bridgeGpsTimer = setInterval(async () => {
      if (cancelled || !isTripActive) return;
      const fix = await fetchLatestBridgeGps();
      if (!fix || !fix.fix || fix.latitude == null || fix.longitude == null) return;

      const pLat = fix.latitude;
      const pLng = fix.longitude;

      // Broadcast hardware GPS from vehicle to Supabase
      broadcastBusGps(pLat, pLng, fix.speed, fix.heading, fix.accuracy);

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

        if (distanceMeters <= ARRIVAL_RADIUS_METERS && distanceMeters < closestDistanceMeters) {
          arrivalStopIndex = index;
          closestDistanceMeters = distanceMeters;
        }
      }

      if (arrivalStopIndex >= 0) {
        const arrivalStopKey = stopsList[arrivalStopIndex].id || arrivalStopIndex;
        if (lastTriggeredStopRef.current !== arrivalStopKey) {
          lastTriggeredStopRef.current = arrivalStopKey;
          triggerArrivalAtStop(arrivalStopIndex);
        }
      }
    }, 2500);

    return () => {
      cancelled = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      clearInterval(bridgeGpsTimer);
    };
  }, [isTripActive, currentStopIndex, stopsList, dutySession.plateNumber]);

  // Keep a stable ref so keyboard event listener doesn't re-create repeatedly
  const handleQrScanRef = useRef(null);

  // QR Code Processing from the embedded USB/RS232-TTL scanner or Camera Modal
  const handleQrScan = async (rawCode) => {
    const raw = String(rawCode || '').trim();
    if (!raw) return;

    // Ensure soft keyboard is dismissed on phones/tablets
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const parsed = parsePassengerQRCode(raw);
    const token = parsed?.tripId || raw.match(/(?:Code|Journey ID|Pass ID):\s*([^\r\n]+)/i)?.[1]?.trim() || raw;

    let effectiveTripId = operationalTripId || dutySession?.tripId || null;
    const found = await fetchJourneyByQrToken(raw, currentStop);

    if (!found.success || !found.data) {
      setStatusMessage(`Scan alert: ${found.error || 'Pass not recognized.'}`);
      return;
    }

    // Resolve boarding & destination stops against canonical Route 4 stops
    const resolvedOrigin = resolveRoute4Stop(parsed?.boardingStop || found.data.origin_name) || currentStop || ROUTE4_STOPS[0];
    const resolvedDestination = resolveRoute4Stop(parsed?.destinationStop || found.data.destination_name) || ROUTE4_STOPS[ROUTE4_STOPS.length - 1];

    const savedTestJourney = passengerRegistry.find((row) => (row.qr_token && row.qr_token === token) || row.id === found.data.id);
    const journey = savedTestJourney ? { ...found.data, ...savedTestJourney } : found.data;
    const isCurrentlyBoarded = (savedTestJourney ? savedTestJourney.status === 'boarded' : found.data.status === 'boarded');
    const nextEventType = isCurrentlyBoarded ? 'alight' : 'board';

    const isPri = isPriorityCategory(journey.passenger_category || journey.profiles?.passenger_category || journey.category);
    const cat = journey.passenger_category || journey.profiles?.passenger_category || journey.category || 'Regular';
    const count = Math.max(1, Number(journey.count || parsed?.count) || 1);

    if (isTestMode) {
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
        passenger_name: 'Anonymous Commuter',
        origin_name: resolvedOrigin.name,
        destination_name: resolvedDestination.name,
        status: nextEventType === 'board' ? 'boarded' : 'completed'
      };
      setPassengerRegistry((rows) => {
        const exists = rows.some((row) => (row.qr_token && row.qr_token === token) || row.id === updatedJourney.id);
        const nextRows = exists
          ? rows.map((row) => ((row.qr_token && row.qr_token === token) || row.id === updatedJourney.id) ? updatedJourney : row)
          : [...rows, updatedJourney];
        try {
          localStorage.setItem(testRegistryKey, JSON.stringify(nextRows));
        } catch (_) {}
        return nextRows;
      });
      setStatusMessage(nextEventType === 'board'
        ? `✓ ${count} passenger${count === 1 ? '' : 's'} boarded (${cat}). Total Onboard: ${totalOnboard + count}/${capacity}. Boarded at: ${resolvedOrigin.name} → Destination: ${resolvedDestination.name}.`
        : `✓ ${count} passenger${count === 1 ? '' : 's'} alighted at ${resolvedDestination.name}. ${count} seat${count === 1 ? '' : 's'} restored. Total Onboard: ${Math.max(0, totalOnboard - count)}/${capacity}.`);
      return;
    }

    if (!effectiveTripId) {
      try {
        effectiveTripId = await ensureOperationalTrip();
      } catch (error) {
        effectiveTripId = dutySession?.tripId || 'operational-trip';
      }
    }

    const now = new Date().toISOString();
    const updatedJourney = {
      ...journey,
      trip_id: effectiveTripId,
      qr_token: journey.qr_token || token,
      count,
      origin_name: resolvedOrigin.name,
      destination_name: resolvedDestination.name,
      status: nextEventType === 'board' ? 'boarded' : 'completed',
      boarded_at: nextEventType === 'board' ? (journey.boarded_at || now) : journey.boarded_at,
      alighted_at: nextEventType === 'alight' ? now : journey.alighted_at
    };

    // Update the journey immediately so boarded-at-stop, alighting-at-stop,
    // and onboard totals all react to this scan without waiting for polling.
    setPassengerRegistry((rows) => {
      const exists = rows.some((row) => row.id === updatedJourney.id || (row.qr_token && row.qr_token === token));
      const nextRows = exists
        ? rows.map((row) => (row.id === updatedJourney.id || (row.qr_token && row.qr_token === token)) ? { ...row, ...updatedJourney } : row)
        : [...rows, updatedJourney];
      try {
        const plate = dutySession?.plateNumber || 'QC-BUS';
        localStorage.setItem(`qcbus_registry_${plate}`, JSON.stringify(nextRows));
      } catch (_) {}
      return nextRows;
    });

    if (nextEventType === 'board') {
      const remainingPriority = isPri ? Math.max(0, availablePrioritySeats - count) : availablePrioritySeats;
      const remainingRegular = !isPri ? Math.max(0, availableRegularSeats - count) : availableRegularSeats;
      const newTotal = totalOnboard + count;
      setStatusMessage(
        `✓ ${count} PASSENGER${count === 1 ? '' : 'S'} BOARDED (${cat}). Total Onboard: ${newTotal}/${busCapacity}. Remaining Seats: ${remainingPriority} Priority / ${remainingRegular} Regular. Boarding at: ${resolvedOrigin.name} → Destination: ${resolvedDestination.name}.`
      );
    } else {
      const newTotal = Math.max(0, totalOnboard - count);
      setStatusMessage(
        `✓ ${count} PASSENGER${count === 1 ? '' : 'S'} ALIGHTED at ${resolvedDestination.name}. ${count} seat${count === 1 ? '' : 's'} restored. Total Onboard: ${newTotal}/${busCapacity}.`
      );
    }

    await recordBoardingEvent({
      tripId: effectiveTripId,
      eventType: nextEventType,
      method: 'qr',
      passengerId: journey.passenger_id || null,
      journeyId: journey.id,
      idempotencyKey: `qr-${journey.id}-${nextEventType}-${Date.now()}`
    });

    // Refresh passenger registry in background
    if (effectiveTripId) {
      fetchPassengerRegistry(effectiveTripId).then((reg) => {
        if (reg.success && reg.data) {
          setPassengerRegistry((prevRows) => {
            const dbRows = reg.data || [];
            const dbIds = new Set(dbRows.map((r) => r.id || r.qr_token));
            const localOnly = prevRows.filter((r) => !dbIds.has(r.id) && (!r.qr_token || !dbIds.has(r.qr_token)));
            return [...dbRows, ...localOnly];
          });
        }
      });
    }
  };

  useEffect(() => {
    handleQrScanRef.current = handleQrScan;
  });

  // Capture keyboard-wedge scanners without focusing an input. This keeps the
  // on-screen keyboard closed on phones/tablets while scans continue to work.
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
          if (handleQrScanRef.current) {
            handleQrScanRef.current(scannedValue);
          }
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

  // Start / Restart Another Trip Handler
  const handleStartAnotherTrip = async (forceNewTrip = false) => {
    setStatusMessage(forceNewTrip ? 'Starting a new trip…' : 'Starting trip…');
    let activeTripId;
    try {
      activeTripId = await ensureOperationalTrip();
      if (forceNewTrip) {
        const nextTrip = await startNextTrip({ currentTripId: activeTripId, direction });
        if (!nextTrip.success || !nextTrip.data?.id) throw new Error(nextTrip.error || 'Unable to start the next trip.');
        activeTripId = nextTrip.data.id;
        setOperationalTripId(activeTripId);
        updateDutySession({ tripId: activeTripId, tripDirection: direction });
      }
    } catch (error) {
      setStatusMessage(`Trip start failed: ${error.message}`);
      return;
    }
    localStorage.removeItem(tripSegmentKey);
    setTripSegmentStartedAt(0);
    setPassengerRegistry([]);
    lastTriggeredStopRef.current = null;
    setCurrentStopIndex(0);
    setIsTripActive(true);
    if (forceNewTrip) setTripCount((prev) => prev + 1);

    // Relay trip direction to Pi 3B Announcer via Pi 4B bridge
    const bridgeRes = await sendDirectionToBridge(direction);
    const announcerNote = bridgeRes.success
      ? '✓ Pi 3B Announcer started'
      : `(Pi 3B notice: ${bridgeRes.error})`;

    const displayedTrip = forceNewTrip ? tripCount + 1 : tripCount;
    setStatusMessage(`Trip #${displayedTrip} (${direction}) started at ${stopsList[0].name}. ${announcerNote}`);
    setTimeout(() => setStatusMessage(null), 6000);
  };

  const handlePauseTrip = async () => {
    setIsTripActive(false);
    await endTripOnBridge();
    setStatusMessage('Trip paused. Pi 3B Bus Announcer set to standby.');
  };

  const handleAlightCurrentStopPassengers = async () => {
    const targetCanonical = resolveRoute4Stop(currentStop.name)?.name || currentStop.name;
    const now = new Date().toISOString();

    const alightingJourneys = passengerRegistry.filter((journey) => {
      const isCurrentlyBoarded = journey.status === 'boarded';
      const stopCanonical = resolveRoute4Stop(journey.destination_name)?.name || journey.destination_name;
      return isCurrentlyBoarded && stopCanonical === targetCanonical;
    });

    if (alightingJourneys.length === 0) return;

    const totalAlightingPax = alightingJourneys.reduce((sum, j) => sum + (Number(j.count) || 1), 0);

    // Update local state immediately
    setPassengerRegistry((prev) => {
      const alightingIds = new Set(alightingJourneys.map((j) => j.id || j.qr_token));
      const next = prev.map((j) => {
        if (alightingIds.has(j.id) || (j.qr_token && alightingIds.has(j.qr_token))) {
          return { ...j, status: 'completed', alighted_at: now };
        }
        return j;
      });
      try {
        const plate = dutySession?.plateNumber || 'QC-BUS';
        const key = isTestMode ? testRegistryKey : `qcbus_registry_${plate}`;
        localStorage.setItem(key, JSON.stringify(next));
      } catch (_) {}
      return next;
    });

    setStatusMessage(`✓ ${totalAlightingPax} passenger${totalAlightingPax === 1 ? '' : 's'} alighted at ${targetCanonical}. Freed seats and updated onboard count.`);

    // Sync in background
    let activeTripId = operationalTripId || dutySession?.tripId;
    for (const journey of alightingJourneys) {
      if (journey.id && !String(journey.id).startsWith('manual-')) {
        supabase.from('passenger_journeys')
          .update({ status: 'completed', alighted_at: now })
          .eq('id', journey.id)
          .catch(() => {});
        if (activeTripId) {
          recordBoardingEvent({
            tripId: activeTripId,
            eventType: 'alight',
            method: 'dashboard',
            journeyId: journey.id,
            idempotencyKey: `alight-${journey.id}-${Date.now()}`
          }).catch(() => {});
        }
      }
    }
  };

  const handleAlightAllRemainingPassengers = async () => {
    const now = new Date().toISOString();
    const onboardJourneys = passengerRegistry.filter((j) => j.status === 'boarded');
    if (onboardJourneys.length === 0) return;

    const totalPax = onboardJourneys.reduce((sum, j) => sum + (Number(j.count) || 1), 0);

    setPassengerRegistry((prev) => {
      const next = prev.map((j) => j.status === 'boarded' ? { ...j, status: 'completed', alighted_at: now } : j);
      try {
        const plate = dutySession?.plateNumber || 'QC-BUS';
        const key = isTestMode ? testRegistryKey : `qcbus_registry_${plate}`;
        localStorage.setItem(key, JSON.stringify(next));
      } catch (_) {}
      return next;
    });

    setStatusMessage(`✓ All ${totalPax} remaining passengers alighted at ${currentStop.name}. Trip complete.`);
  };

  const handleManualRegistration = async (event) => {
    event.preventDefault();
    if (!manualDestination || manualSubmissionRef.current) return;
    if (!isTripActive) {
      setStatusMessage('Passenger registration failed: Start the trip first.');
      return;
    }
    manualSubmissionRef.current = true;
    setManualRegistrationBusy(true);

    const count = Math.max(1, Number(manualPassengerCount) || 1);
    const capacity = busCapacity;
    if (totalOnboard + count > capacity) {
      setStatusMessage(`Passenger registration failed: Only ${Math.max(0, capacity - totalOnboard)} available seat${Math.max(0, capacity - totalOnboard) === 1 ? '' : 's'} remaining.`);
      setManualRegistrationBusy(false);
      manualSubmissionRef.current = false;
      return;
    }
    const isPri = isPriorityCategory(manualPassengerCategory);
    const categoryAvailable = isPri ? availablePrioritySeats : availableRegularSeats;
    if (count > categoryAvailable) {
      setStatusMessage(`Passenger registration failed: Only ${categoryAvailable} ${isPri ? 'priority' : 'regular'} seat${categoryAvailable === 1 ? '' : 's'} available.`);
      setManualRegistrationBusy(false);
      manualSubmissionRef.current = false;
      return;
    }

    let activeTripId = operationalTripId || dutySession?.tripId || null;
    if (!activeTripId) {
      try {
        activeTripId = await ensureOperationalTrip();
      } catch (error) {
        console.warn('Operational trip creation notice:', error.message);
      }
    }

    const canonicalOrigin = resolveRoute4Stop(currentStop.name)?.name || currentStop.name;
    const canonicalDest = resolveRoute4Stop(manualDestination)?.name || manualDestination;
    const now = new Date().toISOString();
    const fallbackId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'manual-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    // Attempt DB creation
    let createdJourney = null;
    try {
      const created = await createManualPassengerJourney({
        passengerName: `Anonymous Passenger (${manualPassengerCategory})`,
        passengerCategory: manualPassengerCategory,
        origin: canonicalOrigin,
        destination: canonicalDest,
        tripId: activeTripId,
        routeDirection: direction,
        passengerCount: count,
        status: 'boarded'
      });
      if (created.success && created.data) {
        createdJourney = created.data;
      }
    } catch (err) {
      console.warn('Database manual journey notice:', err.message);
    }

    const localJourney = {
      id: createdJourney?.id || fallbackId,
      qr_token: createdJourney?.qr_token || fallbackId,
      trip_id: activeTripId,
      passenger_name: `Manual Commuter (${manualPassengerCategory})`,
      passenger_category: manualPassengerCategory,
      is_priority: isPri,
      origin_name: canonicalOrigin,
      destination_name: canonicalDest,
      count,
      status: 'boarded',
      boarded_at: now,
      registration_source: 'manual_stop_arrival'
    };

    // Immediately update local passengerRegistry so:
    // 1. passengersBoardedAt(currentStop.name) increments by count
    // 2. passengersAlightingAt(manualDestination) increments by count
    // 3. totalOnboard increments by count
    // 4. available seats decrement
    setPassengerRegistry((prev) => {
      const next = [...prev, localJourney];
      try {
        const plate = dutySession?.plateNumber || 'QC-BUS';
        const key = isTestMode ? testRegistryKey : `qcbus_registry_${plate}`;
        localStorage.setItem(key, JSON.stringify(next));
      } catch (_) {}
      return next;
    });

    // Record boarding event in background if online
    if (activeTripId && createdJourney?.id) {
      recordBoardingEvent({
        tripId: activeTripId,
        eventType: 'board',
        method: 'dashboard',
        journeyId: createdJourney.id,
        idempotencyKey: `manual-${createdJourney.id}`
      }).catch((e) => console.warn('Record boarding event notice:', e.message));
    }

    const remainingPriority = isPri ? Math.max(0, availablePrioritySeats - count) : availablePrioritySeats;
    const remainingRegular = !isPri ? Math.max(0, availableRegularSeats - count) : availableRegularSeats;
    const stopTotal = passengersBoardedAt(canonicalOrigin) + count;
    setStatusMessage(
      `✓ ${count} passenger${count === 1 ? '' : 's'} boarded at ${canonicalOrigin}. Stop total boarded: ${stopTotal}. Destination: ${canonicalDest} (will alight at Stop ${stopsList.findIndex(s => s.name === canonicalDest) + 1}). Seats: ${remainingPriority} Priority / ${remainingRegular} Regular.`
    );
    setShowManualRegistration(false);
    setManualRegistrationBusy(false);
    manualSubmissionRef.current = false;
  };

  const handleDirectionToggle = async (newDir) => {
    lastTriggeredStopRef.current = null;
    setDirection(newDir);
    setCurrentStopIndex(0);
    setIsTripActive(false);
    updateDutySession({ tripDirection: newDir });

    // Send direction command to Pi 3B Bus Announcer
    const res = await sendDirectionToBridge(newDir);
    if (res.success) {
      setStatusMessage(`Direction updated to ${newDir}. Sent ${newDir} command to Pi 3B Announcer.`);
    } else {
      setStatusMessage(`Direction updated to ${newDir}. Click "Start Trip" to begin. (Pi 3B: ${res.error})`);
    }
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
    <div style={{ display: 'flex', flexDirection: 'column', height: 'auto', minHeight: 'calc(100vh - 5rem)', gap: '0.6rem', boxSizing: 'border-box' }}>
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
                {announcerInfo.online ? (
                  <span className="badge badge-success" style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }} title="Pi 3B Bus Announcer is connected and responsive">
                    <Volume2 size={12} /> Pi 3B Announcer Online
                  </span>
                ) : (
                  <span className="badge" style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid #ef4444', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }} title="Pi 3B Announcer unreachable or bridge offline">
                    <VolumeX size={12} /> Pi 3B Announcer Offline
                  </span>
                )}
                <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>QC Bus Route 4</strong>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                Driver: <strong>{dutySession.driverName}</strong> ({dutySession.driverId}) | Unit: <strong>{dutySession.plateNumber || 'QC-BUS'}</strong>
              </div>
            </div>

            {/* NORTHBOUND & SOUTHBOUND OPTIONS & HARDWARE SCANNER INPUT */}
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
                onClick={() => {
                  if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
                    document.activeElement.blur();
                  }
                  setIsCameraOpen(true);
                }}
                className="btn btn-primary"
                style={{ padding: '0.2rem 0.65rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: '#0284c7', borderColor: '#0284c7' }}
                title="Open Camera QR Scanner"
              >
                <Camera size={13} /> Scan Pass
              </button>

              <div role="status" aria-label="QR scanner is ready" style={{ width: '14rem', padding: '.35rem .55rem', fontSize: '.75rem', border: '1px solid var(--border-color)', borderRadius: '6px', color: '#94a3b8' }}>
                QR scanner ready — no GPS required
              </div>
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

      {/* MANUAL PASSENGER REGISTRATION & STOP ARRIVAL MODAL */}
      {showManualRegistration && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.78)', display: 'grid', placeItems: 'center', zIndex: 1500, padding: '1rem' }}>
          <div className="card" style={{ width: 'min(520px, 100%)', padding: '1.5rem', border: currentStopIndex === stopsList.length - 1 ? '2px solid #f59e0b' : '2px solid #06b6d4', boxShadow: '0 20px 40px rgba(0,0,0,0.6)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
              <span className={`badge ${currentStopIndex === stopsList.length - 1 ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '0.75rem', fontWeight: 800 }}>
                {currentStopIndex === stopsList.length - 1 ? '🏁 TARGET DESTINATION REACHED (STOP 15 OF 15)' : `📍 BUS AT STOP ${currentStopIndex + 1} OF 15`}
              </span>
              <button type="button" onClick={() => setShowManualRegistration(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.25rem', padding: '0 0.25rem' }}>×</button>
            </div>
            <h2 style={{ fontSize: '1.25rem', marginTop: 0, marginBottom: '0.25rem', color: 'var(--text-main)' }}>
              {currentStopIndex === stopsList.length - 1 ? '🏁 Final Terminal Arrival' : `Stop ${currentStopIndex + 1}: Passenger Registry`}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem', lineHeight: '1.4' }}>
              {currentStopIndex === stopsList.length - 1 ? (
                <span style={{ color: '#fbbf24', fontWeight: 700 }}>Bus has arrived at target destination terminal: <strong>{currentStop.name}</strong></span>
              ) : (
                <span>Bus at Stop {currentStopIndex + 1}: <strong style={{ color: '#38bdf8' }}>{currentStop.name}</strong></span>
              )}
            </p>

            {/* ALIGHTING PASSENGERS AT THIS STOP */}
            {(passengersAlightingAt(currentStop.name) > 0 || (currentStopIndex === stopsList.length - 1 && totalOnboard > 0)) && (
              <div style={{ padding: '.75rem .9rem', marginBottom: '1rem', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, .12)', border: '1px solid #ef4444' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
                  <span style={{ color: '#f87171', fontWeight: 800, fontSize: '.9rem' }}>
                    ↓ Alighting at this Stop: {currentStopIndex === stopsList.length - 1 ? totalOnboard : passengersAlightingAt(currentStop.name)} pax
                  </span>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={currentStopIndex === stopsList.length - 1 ? handleAlightAllRemainingPassengers : handleAlightCurrentStopPassengers}
                  style={{ width: '100%', backgroundColor: '#ef4444', color: '#ffffff', fontWeight: 700, padding: '0.55rem', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                >
                  ✓ Confirm Alighting ({currentStopIndex === stopsList.length - 1 ? totalOnboard : passengersAlightingAt(currentStop.name)} pax)
                </button>
              </div>
            )}

            {passengersCompletedAlightedAt(currentStop.name) > 0 && (
              <div style={{ padding: '.45rem .75rem', marginBottom: '.75rem', borderRadius: '6px', backgroundColor: 'rgba(148, 163, 184, .1)', border: '1px solid #64748b', color: '#94a3b8', fontSize: '.78rem' }}>
                ✓ {passengersCompletedAlightedAt(currentStop.name)} passenger(s) have already alighted at this stop.
              </div>
            )}

            {/* BOARDING SECTION (NOT TERMINAL STOP) */}
            {currentStopIndex < stopsList.length - 1 ? (
              <form onSubmit={handleManualRegistration}>
                <div style={{ padding: '.65rem .8rem', marginBottom: '.75rem', borderRadius: '8px', backgroundColor: 'rgba(6, 182, 212, .12)', border: '1px solid #0891b2', color: '#67e8f9', fontWeight: 800, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Already boarded at this stop:</span>
                  <span style={{ fontSize: '1rem' }}>{passengersBoardedAt(currentStop.name)} pax</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '.6rem', marginTop: '.75rem' }}>
                  <div>
                    <label className="form-label" htmlFor="manual-passenger-category">
                      Passenger Category
                    </label>
                    <select
                      id="manual-passenger-category"
                      className="form-select"
                      value={manualPassengerCategory}
                      onChange={(e) => setManualPassengerCategory(e.target.value)}
                    >
                      <option value="Regular">Regular Passenger (Non-Priority /30)</option>
                      <option value="Student">Student (Non-Priority /30)</option>
                      <option value="Senior Citizen">Senior Citizen (Priority /20)</option>
                      <option value="PWD">PWD - Person with Disability (Priority /20)</option>
                      <option value="Pregnant">Pregnant Passenger (Priority /20)</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label" htmlFor="manual-passenger-count">
                      Pax Count
                    </label>
                    <input
                      id="manual-passenger-count"
                      type="number"
                      min="1"
                      max="20"
                      className="form-control"
                      value={manualPassengerCount}
                      onChange={(e) => setManualPassengerCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      style={{ textAlign: 'center', fontWeight: 700 }}
                    />
                  </div>
                </div>

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
                    style={{ flex: 1, backgroundColor: '#06b6d4', borderColor: '#06b6d4', fontWeight: 700 }}
                    disabled={manualRegistrationBusy || !isTripActive || !manualDestination}
                  >
                    {manualRegistrationBusy ? 'Registering…' : `Confirm & Board ${manualPassengerCount} Passenger${manualPassengerCount > 1 ? 's' : ''}`}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <p style={{ color: '#fbbf24', fontSize: '.9rem' }}>This is the final stop of the route. No new boardings allowed.</p>
                <button type="button" className="btn btn-secondary" onClick={() => setShowManualRegistration(false)} style={{ width: '100%', marginTop: '.5rem' }}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MAIN ROUTE STOP SEQUENCE SECTION */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0.75rem', overflow: 'visible', minHeight: '0' }}>
        {/* Sequence Title & Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', flexShrink: 0, flexWrap: 'wrap', gap: '.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <MapPin size={20} color="#06b6d4" />
            <h2 style={{ fontSize: '1.15rem', margin: 0 }}>
              Route Stop Sequence ({direction} View: {direction === 'Northbound' ? 'QC Hall to Gen. Luis' : 'Gen. Luis to QC Hall'})
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isTripActive ? (
              <button
                type="button"
                onClick={handlePauseTrip}
                className="btn btn-secondary"
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
              >
                <Pause size={14} /> Pause Trip
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleStartAnotherTrip(false)}
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
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
          gap: '0.5rem',
          height: 'auto',
          overflow: 'visible'
        }}>
          {stopsList.map((s, idx) => {
            const isCurrent = idx === currentStopIndex;
            const isPassed = idx < currentStopIndex;
            const boardedCount = passengersBoardedAt(s.name);
            const alightingCount = passengersAlightingAt(s.name);
            const completedAlightedCount = passengersCompletedAlightedAt(s.name);

            return (
              <div
                key={s.id || idx}
                onClick={() => triggerArrivalAtStop(idx)}
                title={`Click to set Bus at Stop ${idx + 1} and open manual passenger registration`}
                style={{
                  padding: '0.55rem',
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
                <div style={{ display: 'flex', gap: '.3rem', marginTop: '.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {boardedCount > 0 && (
                    <span style={{ padding: '.15rem .35rem', borderRadius: '4px', background: 'rgba(16,185,129,.2)', border: '1px solid #10b981', color: '#34d399', fontSize: '.68rem', fontWeight: 700 }} title={`${boardedCount} boarded at this stop`}>
                      ↑ {boardedCount} boarded
                    </span>
                  )}
                  {alightingCount > 0 && (
                    <span style={{ padding: '.15rem .35rem', borderRadius: '4px', background: 'rgba(239,68,68,.18)', border: '1px solid #ef4444', color: '#f87171', fontSize: '.68rem', fontWeight: 800 }} title={`${alightingCount} passengers to alight here`}>
                      ↓ {alightingCount} alighting
                    </span>
                  )}
                  {completedAlightedCount > 0 && (
                    <span style={{ padding: '.15rem .35rem', borderRadius: '4px', background: 'rgba(148,163,184,.15)', border: '1px solid #64748b', color: '#94a3b8', fontSize: '.68rem', fontWeight: 600 }} title={`${completedAlightedCount} passengers already alighted here`}>
                      ✓ {completedAlightedCount} alighted
                    </span>
                  )}
                  {boardedCount === 0 && alightingCount === 0 && completedAlightedCount === 0 && (
                    <span style={{ fontSize: '.65rem', color: '#64748b' }}>0 pax</span>
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
            onClick={() => handleStartAnotherTrip(true)}
            className="btn btn-primary"
            style={{ justifyContent: 'center', padding: '0.45rem 1rem', fontSize: '0.88rem', fontWeight: 800, backgroundColor: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RotateCcw size={16} /> Start Another Trip
          </button>
        </div>
      </div>

      {/* CAMERA SCANNER MODAL */}
      <QrCameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={handleQrScan}
        title="Route 4 QR Pass Scanner"
      />
    </div>
  );
}
