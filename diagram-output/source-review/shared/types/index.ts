export interface User {
  id: number;
  username: string;
  email: string;
  role: 'ADMIN' | 'PASSENGER' | 'STAFF';
  is_active: boolean;
  created_at: string;
}

export interface Stop {
  id: number;
  stop_code: string;
  stop_name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  data_source: string;
  created_at: string;
  updated_at: string;
}

export interface RouteStop {
  id: number;
  route_id: number;
  stop_id: number;
  stop_sequence: number;
  estimated_travel_minutes?: number | null;
  created_at: string;
  updated_at: string;
  stop?: Stop;
}

export interface Route {
  id: number;
  route_code: string;
  route_name: string;
  description?: string | null;
  is_active: boolean;
  data_source: string;
  created_at: string;
  updated_at: string;
  stop_count?: number;
  route_stops?: RouteStop[];
}

export interface Bus {
  id: number;
  bus_code: string;
  display_name?: string | null;
  plate_number?: string | null;
  capacity?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: number;
  route_id: number;
  service_day: string;
  departure_time: string;
  arrival_time?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: number;
  route_id: number;
  bus_id?: number | null;
  schedule_id?: number | null;
  scheduled_departure?: string | null;
  actual_departure?: string | null;
  actual_arrival?: string | null;
  status: 'SCHEDULED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED' | 'DELAYED';
  created_at: string;
  updated_at: string;
  route?: Route;
  bus?: Bus;
}

export interface BusLocation {
  id: number;
  bus_id?: number | null;
  trip_id?: number | null;
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  is_simulated: boolean;
  source: string;
  recorded_at: string;
  created_at: string;
}

export interface ImportErrorDetail {
  row_number: number;
  field: string;
  message: string;
  row_data: Record<string, any>;
}

export interface ImportPreviewResponse {
  entity_type: string;
  total_rows: number;
  valid_rows_count: number;
  invalid_rows_count: number;
  errors: ImportErrorDetail[];
  preview_data: Record<string, any>[];
  is_ready_to_commit: boolean;
}

export interface ImportCommitResponse {
  entity_type: string;
  inserted_count: number;
  updated_count: number;
  status: string;
  message: string;
}
