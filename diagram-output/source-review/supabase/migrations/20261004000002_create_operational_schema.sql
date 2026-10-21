-- ========================================================
-- 02: OPERATIONAL SCHEMA (Buses, Routes, Stops, Trips, Passenger Journeys)
-- ========================================================

-- Older deployments created public.trips with a text `tripID` column for
-- passenger history. Preserve that table before creating the UUID-based
-- operational trips table expected by the admin app and boarding RPCs.
DO $$
BEGIN
    IF to_regclass('public.trips') IS NOT NULL
       AND EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'tripID'
       )
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'id'
       ) THEN
        IF to_regclass('public.legacy_trips') IS NOT NULL THEN
            RAISE EXCEPTION 'Both legacy public.trips and public.legacy_trips exist; rename or archive the legacy table before applying the operational schema.';
        END IF;
        ALTER TABLE public.trips RENAME TO legacy_trips;
    END IF;
END;
$$;

-- Trigger function for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 1. Buses Table
CREATE TABLE IF NOT EXISTS public.buses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate_number TEXT NOT NULL UNIQUE,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for buses updated_at
DROP TRIGGER IF EXISTS update_buses_updated_at ON public.buses;
CREATE TRIGGER update_buses_updated_at
    BEFORE UPDATE ON public.buses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Routes Table
CREATE TABLE IF NOT EXISTS public.routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    origin_stop_name TEXT,
    destination_stop_name TEXT,
    est_minutes INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_routes_updated_at ON public.routes;
CREATE TRIGGER update_routes_updated_at
    BEFORE UPDATE ON public.routes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Stops Table
CREATE TABLE IF NOT EXISTS public.stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_route_sequence UNIQUE (route_id, sequence_number)
);

DROP TRIGGER IF EXISTS update_stops_updated_at ON public.stops;
CREATE TRIGGER update_stops_updated_at
    BEFORE UPDATE ON public.stops
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Trips Table
CREATE TABLE IF NOT EXISTS public.trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE RESTRICT,
    route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_trips_updated_at ON public.trips;
CREATE TRIGGER update_trips_updated_at
    BEFORE UPDATE ON public.trips
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Passenger Journeys Table
CREATE TABLE IF NOT EXISTS public.passenger_journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    passenger_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
    origin_name TEXT NOT NULL,
    origin_lat DOUBLE PRECISION CHECK (origin_lat IS NULL OR (origin_lat BETWEEN -90 AND 90)),
    origin_lng DOUBLE PRECISION CHECK (origin_lng IS NULL OR (origin_lng BETWEEN -180 AND 180)),
    destination_name TEXT NOT NULL,
    destination_lat DOUBLE PRECISION CHECK (destination_lat IS NULL OR (destination_lat BETWEEN -90 AND 90)),
    destination_lng DOUBLE PRECISION CHECK (destination_lng IS NULL OR (destination_lng BETWEEN -180 AND 180)),
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'boarded', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT origin_dest_not_same CHECK (origin_name <> destination_name)
);

DROP TRIGGER IF EXISTS update_passenger_journeys_updated_at ON public.passenger_journeys;
CREATE TRIGGER update_passenger_journeys_updated_at
    BEFORE UPDATE ON public.passenger_journeys
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance & query optimization
CREATE INDEX IF NOT EXISTS idx_passenger_journeys_passenger_id ON public.passenger_journeys(passenger_id);
CREATE INDEX IF NOT EXISTS idx_passenger_journeys_trip_id ON public.passenger_journeys(trip_id);
CREATE INDEX IF NOT EXISTS idx_passenger_journeys_created_at ON public.passenger_journeys(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_bus_status ON public.trips(bus_id, status);

NOTIFY pgrst, 'reload schema';
