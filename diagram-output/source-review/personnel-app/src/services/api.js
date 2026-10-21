/**
 * Admin Portal API Service (JavaScript)
 * Interacts with backend FastAPI administrative endpoints.
 */
import axios from 'axios';

const API_BASE = (typeof process !== 'undefined' && process.env?.BACKEND_URL)
  ? `${process.env.BACKEND_URL}/api/v1`
  : (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || '/api/v1');

export const adminApi = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach Bearer JWT Token
adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export async function loginAdmin(username, password) {
  const res = await adminApi.post('/auth/login', { username, password });
  return res.data;
}

export async function fetchMe() {
  const res = await adminApi.get('/auth/me');
  return res.data;
}

// Routes CRUD
export async function getAdminRoutes(q) {
  const params = {};
  if (q) params.q = q;
  const res = await adminApi.get('/routes', { params });
  return res.data;
}

export async function createRoute(data) {
  const res = await adminApi.post('/routes', data);
  return res.data;
}

export async function updateRoute(id, data) {
  const res = await adminApi.put(`/routes/${id}`, data);
  return res.data;
}

export async function deleteRoute(id) {
  await adminApi.delete(`/routes/${id}`);
}

// Route Stop Sequence Management
export async function getRouteStops(routeId) {
  const res = await adminApi.get(`/routes/${routeId}/stops`);
  return res.data;
}

export async function addStopToRoute(routeId, stopId, sequence, estMinutes) {
  const res = await adminApi.post(`/routes/${routeId}/stops`, {
    stop_id: stopId,
    stop_sequence: sequence,
    estimated_travel_minutes: estMinutes,
  });
  return res.data;
}

export async function reorderRouteStops(routeId, sequences) {
  const res = await adminApi.put(`/routes/${routeId}/stops/reorder`, { sequences });
  return res.data;
}

export async function removeStopFromRoute(routeId, stopId) {
  await adminApi.delete(`/routes/${routeId}/stops/${stopId}`);
}

// Stops CRUD
export async function getAdminStops(q) {
  const params = {};
  if (q) params.q = q;
  const res = await adminApi.get('/stops', { params });
  return res.data;
}

export async function createStop(data) {
  const res = await adminApi.post('/stops', data);
  return res.data;
}

export async function updateStop(id, data) {
  const res = await adminApi.put(`/stops/${id}`, data);
  return res.data;
}

export async function deleteStop(id) {
  await adminApi.delete(`/stops/${id}`);
}

// Schedules CRUD
export async function getAdminSchedules() {
  const res = await adminApi.get('/schedules');
  return res.data;
}

export async function createSchedule(data) {
  const res = await adminApi.post('/schedules', data);
  return res.data;
}

export async function updateSchedule(id, data) {
  const res = await adminApi.put(`/schedules/${id}`, data);
  return res.data;
}

export async function deleteSchedule(id) {
  await adminApi.delete(`/schedules/${id}`);
}

// Buses CRUD
export async function getAdminBuses() {
  const res = await adminApi.get('/buses');
  return res.data;
}

export async function createBus(data) {
  const res = await adminApi.post('/buses', data);
  return res.data;
}

export async function updateBus(id, data) {
  const res = await adminApi.put(`/buses/${id}`, data);
  return res.data;
}

export async function deleteBus(id) {
  await adminApi.delete(`/buses/${id}`);
}

// Trips CRUD
export async function getAdminTrips() {
  const res = await adminApi.get('/trips');
  return res.data;
}

export async function createTrip(data) {
  const res = await adminApi.post('/trips', data);
  return res.data;
}

export async function updateTrip(id, data) {
  const res = await adminApi.put(`/trips/${id}`, data);
  return res.data;
}

export async function deleteTrip(id) {
  await adminApi.delete(`/trips/${id}`);
}

// Dataset Importer
export async function previewImport(entityType, file) {
  const formData = new FormData();
  formData.append('entity_type', entityType);
  formData.append('file', file);

  const res = await adminApi.post('/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function commitImport(entityType, data) {
  const res = await adminApi.post('/import/commit', {
    entity_type: entityType,
    data,
  });
  return res.data;
}

export async function getHealthDB() {
  const res = await adminApi.get('/health/db');
  return res.data;
}
