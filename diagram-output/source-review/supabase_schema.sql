-- ==============================================================================
-- [DEPRECATED / LEGACY SCHEMA FILE] DO NOT EXECUTE THIS FILE IN PRODUCTION!
-- ==============================================================================
-- WARNING: This standalone SQL file describes an obsolete, legacy database schema
-- with text-based primary keys and outdated table definitions (passengers, staff).
--
-- THE SOLE AUTHORITATIVE DATABASE SCHEMA FOR THIS PROJECT IS LOCATED IN:
--   supabase/migrations/
--
-- Please execute migrations exclusively via the Supabase CLI (`supabase db push` / `supabase migration apply`)
-- or by executing the SQL files under `supabase/migrations/` in numerical order.
-- ==============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- --------------------------------------------------------
-- PASSENGER APP TABLES
-- --------------------------------------------------------

-- 1. Passenger Table (unique for every user of the app)
CREATE TABLE IF NOT EXISTS public.passengers (
    "userID" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "account" TEXT,
    "category" TEXT DEFAULT 'Regular',
    "feedbacks" TEXT,
    "time_boarded" TIMESTAMPTZ DEFAULT NOW(),
    "time_alighted" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Trip Table (unique for every trip made by each user)
CREATE TABLE IF NOT EXISTS public.trips (
    "tripID" TEXT PRIMARY KEY,
    "userID" TEXT REFERENCES public.passengers("userID") ON DELETE SET NULL,
    "startStop" TEXT NOT NULL,
    "destinationStop" TEXT NOT NULL,
    "tripTime" TEXT DEFAULT CURRENT_TIME::text,
    "status" TEXT DEFAULT 'Active', -- Active / Done
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------
-- ADMIN APP TABLES
-- --------------------------------------------------------

-- 3. Staff Table (unique for every driver in each bus)
CREATE TABLE IF NOT EXISTS public.staff (
    "driverID" TEXT PRIMARY KEY,
    "driverName" TEXT NOT NULL,
    "conductorName" TEXT NOT NULL,
    "busPlate" TEXT NOT NULL,
    "passengerCap" INTEGER DEFAULT 50,
    "tripDirection" TEXT DEFAULT 'Northbound',
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Trip Details Table (unique for every end-to-end trip made by the bus driver)
CREATE TABLE IF NOT EXISTS public.trip_details (
    "bustripID" TEXT PRIMARY KEY,
    "driverID" TEXT REFERENCES public.staff("driverID") ON DELETE SET NULL,
    "tripDirection" TEXT NOT NULL,
    "stopName" TEXT NOT NULL,
    "alightedpassengerperstop" INTEGER DEFAULT 0,
    "boardedpassengerperstop" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) and grant anon access for public application usage
ALTER TABLE public.passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select passengers" ON public.passengers FOR SELECT USING (true);
CREATE POLICY "Allow public insert passengers" ON public.passengers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update passengers" ON public.passengers FOR UPDATE USING (true);

CREATE POLICY "Allow public select trips" ON public.trips FOR SELECT USING (true);
CREATE POLICY "Allow public insert trips" ON public.trips FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update trips" ON public.trips FOR UPDATE USING (true);

CREATE POLICY "Allow public select staff" ON public.staff FOR SELECT USING (true);
CREATE POLICY "Allow public insert staff" ON public.staff FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update staff" ON public.staff FOR UPDATE USING (true);

CREATE POLICY "Allow public select trip_details" ON public.trip_details FOR SELECT USING (true);
CREATE POLICY "Allow public insert trip_details" ON public.trip_details FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update trip_details" ON public.trip_details FOR UPDATE USING (true);
