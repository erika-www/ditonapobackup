/**
 * Passenger API Service (JavaScript)
 * Fetches transit data from backend REST API or Supabase endpoints,
 * with automatic fallback to mock data for offline/standalone execution.
 */
import axios from 'axios';
import { QC_ROUTES, OFFICIAL_ROUTE4_STOPS, MOCK_BUS_FLEET } from '../mockData';

const API_BASE = (typeof process !== 'undefined' && process.env?.BACKEND_URL)
  ? `${process.env.BACKEND_URL}/api/v1`
  : (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || '/api/v1');

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000,
});

export async function fetchRoutes(search) {
  const params = {};
  if (search) params.q = search;
  const res = await api.get('/routes', { params });
  return res.data;
}

export async function fetchRouteDetail(id) {
  const res = await api.get(`/routes/${id}`);
  return res.data;
}

export async function fetchRouteStops(routeId) {
  const res = await api.get(`/routes/${routeId}/stops`);
  return res.data;
}

export async function fetchStops(search) {
  const params = {};
  if (search) params.q = search;
  const res = await api.get('/stops', { params });
  return res.data;
}

export async function fetchStopDetail(id) {
  const res = await api.get(`/stops/${id}`);
  return res.data;
}

export async function fetchRouteSchedules(routeId) {
  const res = await api.get(`/schedules/route/${routeId}`);
  return res.data;
}

export async function fetchTrips(routeId, status) {
  const params = {};
  if (routeId) params.route_id = routeId;
  if (status) params.status = status;
  const res = await api.get('/trips', { params });
  return res.data;
}

export async function fetchHealthDB() {
  const res = await api.get('/health/db');
  return res.data;
}

/**
 * Fetch Routes with backend API integration & mockData fallback
 */
export async function fetchRoutesWithFallback(search = '') {
  try {
    const data = await fetchRoutes(search);
    if (Array.isArray(data) && data.length > 0) {
      // Map API schema to Passenger App UI route structure
      return data.map(r => ({
        id: `route-${r.id || r.route_code}`,
        dbId: r.id,
        name: r.route_name || r.name,
        code: r.route_code || `R${r.id}`,
        color: r.color || '#0284c7',
        description: r.description || 'Quezon City Bus Route',
        totalDistanceKm: r.total_distance_km || 14.5,
        estMinutes: r.estimated_minutes || 45,
        stops: (r.stops && r.stops.length > 0) ? r.stops.map(s => ({
          id: `stop-${s.id}`,
          name: s.stop_name || s.name,
          landmark: s.address || s.landmark || 'Bus Stop',
          lat: parseFloat(s.latitude) || 14.6502,
          lng: parseFloat(s.longitude) || 121.0520
        })) : OFFICIAL_ROUTE4_STOPS
      }));
    }
  } catch (err) {
    if (import.meta.env.PROD) {
      console.error('[API Error] Failed to fetch routes in production:', err.message);
      throw err;
    }
    console.info('[DEV Fallback] Backend REST API unavailable, using mock routes:', err.message);
  }

  // Fallback to local QC_ROUTES mock data in DEV mode
  if (!search) return QC_ROUTES;
  const q = search.toLowerCase();
  return QC_ROUTES.filter(r => 
    r.name.toLowerCase().includes(q) || 
    r.code.toLowerCase().includes(q) ||
    r.description.toLowerCase().includes(q)
  );
}

/**
 * Fetch Stops with backend API integration & mockData fallback
 */
export async function fetchStopsWithFallback(search = '') {
  try {
    const data = await fetchStops(search);
    if (Array.isArray(data) && data.length > 0) {
      return data.map(s => ({
        id: `stop-${s.id}`,
        name: s.stop_name || s.name,
        landmark: s.address || s.landmark || 'Bus Stop',
        lat: parseFloat(s.latitude) || 14.6502,
        lng: parseFloat(s.longitude) || 121.0520
      }));
    }
  } catch (err) {
    if (import.meta.env.PROD) {
      console.error('[API Error] Failed to fetch stops in production:', err.message);
      throw err;
    }
    console.info('[DEV Fallback] Backend REST API unavailable, using mock stops:', err.message);
  }

  if (!search) return OFFICIAL_ROUTE4_STOPS;
  const q = search.toLowerCase();
  return OFFICIAL_ROUTE4_STOPS.filter(s => 
    s.name.toLowerCase().includes(q) || 
    s.landmark.toLowerCase().includes(q)
  );
}

/**
 * Fetch Bus Fleet / Live Trips with backend API integration & mockData fallback
 */
export async function fetchTripsWithFallback(routeId = null, status = 'IN_TRANSIT') {
  try {
    const data = await fetchTrips(routeId, status);
    if (Array.isArray(data) && data.length > 0) {
      return data.map(t => ({
        id: `bus-${t.id || t.bus_id}`,
        busNumber: t.bus_number || `QC-BUS-${t.id}`,
        driverName: t.driver_name || 'QC Bus Driver',
        currentLat: parseFloat(t.current_lat) || 14.6502,
        currentLng: parseFloat(t.current_lng) || 121.0520,
        speedKmH: t.speed_kmh || 28,
        regularSeatedCount: t.regular_seated || 32,
        regularSeatedCap: 40,
        prioritySeatedCount: t.priority_seated || 6,
        prioritySeatedCap: 10,
        standingCount: t.standing_count || 5,
        standingCap: 15,
        status: t.status || 'En Route',
        nextStopName: t.next_stop_name || 'Upcoming Stop',
        etaMinutes: t.eta_minutes || 4
      }));
    }
  } catch (err) {
    if (import.meta.env.PROD) {
      console.error('[API Error] Failed to fetch trips in production:', err.message);
      throw err;
    }
    console.info('[DEV Fallback] Backend REST API unavailable, using mock bus fleet:', err.message);
  }

  return MOCK_BUS_FLEET;
}
