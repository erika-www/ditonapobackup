-- ========================================================
-- 04: LIVE GPS TRACKING & DEVICE AUTHENTICATION SCHEMA
-- ========================================================

-- 1. Device Keys Table (Stores API key hashes for GPS Hardware Devices)
CREATE TABLE IF NOT EXISTS public.device_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,
    device_name TEXT NOT NULL DEFAULT 'QC Bus GPS Tracker',
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Bus Locations History Table
CREATE TABLE IF NOT EXISTS public.bus_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    speed DOUBLE PRECISION CHECK (speed IS NULL OR speed >= 0),
    heading DOUBLE PRECISION CHECK (heading IS NULL OR (heading BETWEEN 0 AND 360)),
    accuracy DOUBLE PRECISION,
    recorded_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bus_locations_bus_recorded ON public.bus_locations(bus_id, recorded_at DESC);

-- 3. Bus Current Location Table (Single latest state per bus)
CREATE TABLE IF NOT EXISTS public.bus_current_location (
    bus_id UUID PRIMARY KEY REFERENCES public.buses(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    speed DOUBLE PRECISION CHECK (speed IS NULL OR speed >= 0),
    heading DOUBLE PRECISION CHECK (heading IS NULL OR (heading BETWEEN 0 AND 360)),
    accuracy DOUBLE PRECISION,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Enable Supabase Realtime Publication for specific operational tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.bus_current_location;
ALTER PUBLICATION supabase_realtime ADD TABLE public.boarding_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.passenger_journeys;
