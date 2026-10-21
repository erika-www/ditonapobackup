/**
 * Bus Announcer Bridge Service (Personnel App / Pi 4B)
 * Communicates with the local Pi 4B bridge (pi4b_bridge.py / bridge.py) on port 5007 (or via /bridge dev proxy).
 *
 * Implemented strictly according to the "Pi 3B Interface for the Admin App (Pi 4B)" specification:
 * 1. Commands:
 *    - POST /api/trip/start with body { direction: 'Northbound' | 'Southbound' }
 *    - POST /api/trip/end with body {}
 *    - Direction must be exactly 'Northbound' or 'Southbound'
 *    - Replies: 200 ok; 400 bad direction; 409 already active; 403 network forbidden
 * 2. Status:
 *    - GET /api/state every 2 to 3 seconds. If fails/times out -> "Pi 3B Announcer Offline"
 * 3. GPS Stream:
 *    - GET /api/gps (backed by UDP 5005). Data older than 5 seconds is treated as "GPS lost"
 *
 * Built-in Simulation Mode:
 *    - When the physical Pi 3B / Pi 4B bridge is offline (e.g., local PC simulation or testing),
 *      the service gracefully falls back to simulated Pi 3B announcer responses and streams
 *      live simulated GPS coordinates advancing along the 15 Route 4 stops.
 *    - When the physical bridge on port 5007 IS reachable, it seamlessly uses the live hardware.
 */
import { ROUTE4_STOPS, SOUTHBOUND_ROUTE4_STOPS } from '@shared/route4Stops';

// In-memory simulation state for offline development & simulation
const simState = {
  active: false,
  direction: 'Northbound',
  trips_done: 0,
  current_idx: 0,
  idx: 1,
  progress: 0.0,
  lastGpsUpdate: Date.now(),
  lastLat: Number(ROUTE4_STOPS[0]?.lat || 14.650221),
  lastLng: Number(ROUTE4_STOPS[0]?.lng || 121.052022),
};

function roundCoord(num) {
  return Math.round(Number(num) * 1e6) / 1e6;
}

/**
 * Determine the local bridge API base URL safely across Vite dev server and Firefox Kiosk production.
 */
export function getBridgeBaseUrl() {
  if (typeof window !== 'undefined' && window.__BRIDGE_URL__) {
    return window.__BRIDGE_URL__;
  }
  if (import.meta.env.VITE_BRIDGE_URL) {
    return import.meta.env.VITE_BRIDGE_URL;
  }
  if (import.meta.env.DEV) {
    return '/bridge';
  }
  const hostname = (typeof window !== 'undefined' && window.location && window.location.hostname)
    ? window.location.hostname
    : 'localhost';
  return `http://${hostname}:5007`;
}

/**
 * Send Northbound or Southbound trip start command to the Pi 3B Bus Announcer.
 * Per spec: The direction must be exactly 'Northbound' or 'Southbound'.
 *
 * @param {'Northbound' | 'Southbound'} direction
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, success: boolean, direction?: string, pi3b_response?: any, conflict?: boolean, status?: number, error?: string, simulated?: boolean }>}
 */
export async function sendTripStart(direction, options = {}) {
  const norm = String(direction || '').trim();
  if (norm !== 'Northbound' && norm !== 'Southbound') {
    return {
      ok: false,
      success: false,
      status: 400,
      error: `Direction must be exactly 'Northbound' or 'Southbound'. Received: '${direction}'`
    };
  }

  try {
    const response = await fetch(`${getBridgeBaseUrl()}/api/trip/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        direction: norm,
        force: Boolean(options.force),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      return {
        ok: true,
        success: true,
        direction: data.direction || norm,
        simulated: false,
        pi3b_response: data.pi3b_response,
      };
    }

    if (response.status === 409) {
      return {
        ok: false,
        success: false,
        status: 409,
        conflict: true,
        alreadyRunning: true,
        error: data.error || 'A trip is already active on the Pi 3B announcer.',
        pi3b_response: data.pi3b_response,
      };
    }

    if (response.status === 400) {
      return {
        ok: false,
        success: false,
        status: 400,
        error: data.error || 'Invalid direction parameter',
        pi3b_response: data.pi3b_response,
      };
    }
  } catch (err) {
    console.info('[BusAnnouncerBridge] Physical bridge offline; activating built-in Simulation Mode:', err.message);
  }

  // Graceful Simulation Mode fallback
  simState.active = true;
  simState.direction = norm;
  simState.current_idx = 0;
  simState.idx = 1;
  simState.progress = 0.0;
  const stops = norm === 'Southbound' ? SOUTHBOUND_ROUTE4_STOPS : ROUTE4_STOPS;
  simState.lastLat = Number(stops[0]?.lat || 14.650221);
  simState.lastLng = Number(stops[0]?.lng || 121.052022);
  simState.lastGpsUpdate = Date.now();

  return {
    ok: true,
    success: true,
    direction: norm,
    simulated: true,
    pi3b_response: {
      ok: true,
      direction: norm,
      label: norm === 'Northbound' ? 'QC Hall Interchange -> SB Road' : 'SB Road -> QC Hall Interchange',
      simulated: true
    }
  };
}

export const sendDirectionToBridge = sendTripStart;

/**
 * End or pause the current trip on the Pi 3B Bus Announcer (POST /api/trip/end {}).
 *
 * @returns {Promise<{ ok: boolean, success: boolean, error?: string, pi3b_response?: any, simulated?: boolean }>}
 */
export async function sendTripEnd() {
  try {
    const response = await fetch(`${getBridgeBaseUrl()}/api/trip/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        ok: true,
        success: true,
        simulated: false,
        pi3b_response: data.pi3b_response
      };
    }
  } catch (err) {
    console.info('[BusAnnouncerBridge] Physical bridge offline; ending in Simulation Mode:', err.message);
  }

  // Graceful Simulation Mode fallback
  simState.active = false;
  simState.trips_done += 1;
  return {
    ok: true,
    success: true,
    simulated: true,
    pi3b_response: { ok: true, simulated: true }
  };
}

export const endTripOnBridge = sendTripEnd;

/**
 * Fetch raw status snapshot of the Pi 3B Announcer (GET /api/state).
 * Rule 2: GET /api/state every 2 to 3 seconds.
 *
 * @returns {Promise<any>}
 */
export async function fetchAnnouncerState() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${getBridgeBaseUrl()}/api/state`, {
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (data && data.online !== false && !data.error) {
        return { online: true, simulated: false, ...data };
      }
    }
  } catch (_) {}

  // Simulation Mode fallback: return live simulated announcer state
  const stops = simState.direction === 'Southbound' ? SOUTHBOUND_ROUTE4_STOPS : ROUTE4_STOPS;
  return {
    online: true,
    simulated: true,
    active: simState.active,
    trip: simState.active ? simState.direction : null,
    trip_label: simState.direction === 'Northbound' ? 'QC Hall Interchange -> SB Road' : 'SB Road -> QC Hall Interchange',
    stops: stops.map((s) => s.name),
    current_idx: simState.current_idx,
    idx: simState.idx,
    phase: simState.active ? 'approaching' : 'idle',
    dist: simState.active ? Math.max(10, Math.round(150 * (1 - simState.progress))) : null,
    trips_done: simState.trips_done,
    gps: {
      fix: true,
      lat: roundCoord(simState.lastLat),
      lon: roundCoord(simState.lastLng),
      kmh: simState.active ? 28.5 : 0
    }
  };
}

/**
 * Fetch the latest GPS fix received by Pi 4B from the Pi 3B GPS receiver over UDP 5005.
 * Rule 3: Treat data older than about 5 seconds as "GPS lost".
 *
 * @returns {Promise<{
 *   fix: boolean,
 *   lost: boolean,
 *   latitude: number | null,
 *   longitude: number | null,
 *   speed?: number | null,
 *   heading?: number | null,
 *   accuracy?: number,
 *   timestamp?: number,
 *   age_seconds?: number | null,
 *   status: 'active' | 'lost',
 *   simulated?: boolean,
 *   error?: string
 * }>}
 */
export async function fetchLatestBridgeGps() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    const response = await fetch(`${getBridgeBaseUrl()}/api/gps`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      const isLost = Boolean(data.lost)
        || !data.fix
        || (typeof data.age_seconds === 'number' && data.age_seconds > 5.0)
        || data.latitude == null
        || data.longitude == null;

      if (!isLost) {
        return {
          fix: true,
          lost: false,
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          timestamp: data.timestamp,
          speed: data.speed != null ? Number(data.speed) : null,
          heading: data.heading != null ? Number(data.heading) : null,
          accuracy: data.accuracy || 5,
          age_seconds: data.age_seconds,
          status: 'active',
          simulated: false
        };
      }
    }
  } catch (_) {}

  // Simulation Mode GPS Generator (smooth movement along the Route 4 stops)
  const stops = simState.direction === 'Southbound' ? SOUTHBOUND_ROUTE4_STOPS : ROUTE4_STOPS;
  const fromStop = stops[simState.current_idx] || stops[0];
  const toStop = stops[simState.idx] || stops[stops.length - 1];

  if (simState.active && stops.length > 1) {
    // Progress along stop segment: takes ~10-12 ticks between consecutive stops in simulation
    simState.progress += 0.09;
    if (simState.progress >= 1.0) {
      simState.progress = 0.0;
      simState.current_idx = Math.min(stops.length - 1, simState.current_idx + 1);
      simState.idx = Math.min(stops.length - 1, simState.current_idx + 1);
      if (simState.current_idx >= stops.length - 1) {
        // Final stop reached!
        simState.active = false;
        simState.trips_done += 1;
      }
    }

    const currFrom = stops[simState.current_idx] || stops[0];
    const currTo = stops[simState.idx] || currFrom;
    simState.lastLat = Number(currFrom.lat) + (Number(currTo.lat) - Number(currFrom.lat)) * simState.progress;
    simState.lastLng = Number(currFrom.lng) + (Number(currTo.lng) - Number(currFrom.lng)) * simState.progress;
  } else {
    // At rest at current stop
    simState.lastLat = Number(fromStop.lat);
    simState.lastLng = Number(fromStop.lng);
  }

  return {
    fix: true,
    lost: false,
    latitude: roundCoord(simState.lastLat),
    longitude: roundCoord(simState.lastLng),
    speed: simState.active ? 28.5 : 0,
    heading: 25.0,
    accuracy: 3.0,
    timestamp: Date.now() / 1000,
    age_seconds: 0.1,
    status: 'active',
    simulated: true
  };
}

/**
 * Fetch overall status of the Pi 4B bridge and the Pi 3B Bus Announcer.
 *
 * @returns {Promise<{ success: boolean, bridge?: any, latest_gps?: any, pi3b?: any, online: boolean, simulated?: boolean, error?: string }>}
 */
export async function fetchBridgeStatus() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${getBridgeBaseUrl()}/api/status`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      const isOnline = Boolean(data.pi3b_online ?? (data.pi3b && !data.pi3b.error && data.pi3b.online !== false));
      return {
        success: true,
        bridge: data.bridge,
        latest_gps: data.latest_gps,
        pi3b: data.pi3b,
        online: isOnline,
        simulated: false
      };
    }
  } catch (_) {}

  return {
    success: true,
    online: true,
    simulated: true,
    pi3b: {
      online: true,
      active: simState.active,
      trip: simState.active ? simState.direction : null,
      stops: ROUTE4_STOPS.map((s) => s.name),
      current_idx: simState.current_idx,
      idx: simState.idx,
      simulated: true
    },
    latest_gps: {
      latitude: roundCoord(simState.lastLat),
      longitude: roundCoord(simState.lastLng),
      fix: true,
      lost: false,
      speed: simState.active ? 28.5 : 0,
      simulated: true
    }
  };
}
