/**
 * Bus Announcer Bridge Service (Personnel App / Pi 4B)
 * Communicates with the local Pi 4B bridge (bridge.py) on port 5007 (or via /bridge proxy)
 * to relay Northbound / Southbound trip commands and monitor Pi 3B announcer state.
 */

const BRIDGE_BASE_URL = (typeof window !== 'undefined' && window.__BRIDGE_URL__)
  || import.meta.env.VITE_BRIDGE_URL
  || (import.meta.env.DEV ? '/bridge' : 'http://localhost:5007');

/**
 * Send Northbound or Southbound trip start command to the Pi 3B Bus Announcer.
 * @param {'Northbound' | 'Southbound'} direction
 * @param {{ force?: boolean }} [options] If true, automatically ends any conflicting active trip on Pi 3B and starts anew.
 * @returns {Promise<{ success: boolean, direction?: string, pi3b_response?: any, conflict?: boolean, status?: number, error?: string }>}
 */
export async function sendDirectionToBridge(direction, options = {}) {
  try {
    const norm = String(direction || '').trim();
    if (!norm) throw new Error('Direction is required');

    const response = await fetch(`${BRIDGE_BASE_URL}/api/trip/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        direction: norm,
        force: Boolean(options.force),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        conflict: response.status === 409,
        error: data.error || `Bridge returned HTTP ${response.status}`,
        pi3b_response: data.pi3b_response,
      };
    }

    return {
      success: true,
      direction: data.direction || norm,
      pi3b_response: data.pi3b_response,
    };
  } catch (err) {
    console.warn('[BusAnnouncerBridge] Could not send direction to bridge:', err.message);
    return {
      success: false,
      error: err.message || 'Bridge offline',
    };
  }
}

/**
 * End or pause the current trip on the Pi 3B Bus Announcer.
 * @returns {Promise<{ success: boolean, error?: string, pi3b_response?: any }>}
 */
export async function endTripOnBridge() {
  try {
    const response = await fetch(`${BRIDGE_BASE_URL}/api/trip/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Bridge returned HTTP ${response.status}`);
    }

    return { success: true, pi3b_response: data.pi3b_response };
  } catch (err) {
    console.warn('[BusAnnouncerBridge] Could not send end trip to bridge:', err.message);
    return {
      success: false,
      error: err.message || 'Bridge offline',
    };
  }
}

/**
 * Fetch raw status snapshot of the Pi 3B Announcer (/api/state).
 * Per communication spec:
 * - active (true / false) and trip (the direction)
 * - gps.fix, gps.lat, gps.lon, gps.kmh
 * - trips_done and last_trip (direction, finished_at)
 * @returns {Promise<any | null>}
 */
export async function fetchAnnouncerState() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${BRIDGE_BASE_URL}/api/state`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Fetch status of the Pi 4B bridge and the Pi 3B Bus Announcer.
 * @returns {Promise<{ success: boolean, bridge?: any, latest_gps?: any, pi3b?: any, online: boolean, error?: string }>}
 */
export async function fetchBridgeStatus() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);

    const response = await fetch(`${BRIDGE_BASE_URL}/api/status`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Bridge returned HTTP ${response.status}`);
    }

    return {
      success: true,
      bridge: data.bridge,
      latest_gps: data.latest_gps,
      pi3b: data.pi3b,
      online: Boolean(data.pi3b && !data.pi3b.error),
    };
  } catch (err) {
    return {
      success: false,
      online: false,
      error: err.message || 'Bridge unreachable',
    };
  }
}

/**
 * Fetch the latest GPS fix received by Pi 4B from the Pi 3B GPS receiver over UDP 5005.
 * @returns {Promise<{ latitude: number, longitude: number, fix: boolean, timestamp?: number, age_seconds: number | null } | null>}
 */
export async function fetchLatestBridgeGps() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${BRIDGE_BASE_URL}/api/gps`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const data = await response.json();
    if (data.fix && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      return {
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: data.timestamp,
        fix: true,
        age_seconds: data.age_seconds,
      };
    }
    return null;
  } catch {
    return null;
  }
}
