-- ========================================================
-- 05: ENFORCE STRICT ROW-LEVEL SECURITY (RLS) POLICIES
-- ========================================================

-- Enable RLS on every table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boarding_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bus_current_location ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_keys ENABLE ROW LEVEL SECURITY;

-- Clean up old public legacy policies if present
DROP POLICY IF EXISTS "Allow public select passengers" ON public.passengers;
DROP POLICY IF EXISTS "Allow public insert passengers" ON public.passengers;
DROP POLICY IF EXISTS "Allow public update passengers" ON public.passengers;
DROP POLICY IF EXISTS "Allow public select trips" ON public.trips;
DROP POLICY IF EXISTS "Allow public insert trips" ON public.trips;
DROP POLICY IF EXISTS "Allow public update trips" ON public.trips;
DROP POLICY IF EXISTS "Allow public select staff" ON public.staff;
DROP POLICY IF EXISTS "Allow public select trip_details" ON public.trip_details;

-- --------------------------------------------------------
-- POLICIES FOR: profiles
-- --------------------------------------------------------
CREATE POLICY "Users and admins can view relevant profiles" 
ON public.profiles FOR SELECT 
TO authenticated 
USING ((SELECT auth.uid()) = id OR (SELECT public.get_current_user_role()) = 'admin');

CREATE POLICY "Users can update own profile except role" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING ((SELECT auth.uid()) = id)
WITH CHECK ((SELECT auth.uid()) = id AND role = (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid())));

-- --------------------------------------------------------
-- POLICIES FOR: admin_users
-- --------------------------------------------------------
CREATE POLICY "Only admins can view admin_users" 
ON public.admin_users FOR SELECT 
TO authenticated 
USING ((SELECT public.get_current_user_role()) = 'admin');

CREATE POLICY "Only admins can manage admin_users" 
ON public.admin_users FOR ALL 
TO authenticated 
USING ((SELECT public.get_current_user_role()) = 'admin');

-- --------------------------------------------------------
-- POLICIES FOR: buses, routes, stops, trips (Public Read, Admin Write)
-- --------------------------------------------------------
CREATE POLICY "Public read buses" ON public.buses FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admin write buses" ON public.buses FOR ALL TO authenticated USING ((SELECT public.get_current_user_role()) = 'admin');

CREATE POLICY "Public read routes" ON public.routes FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admin write routes" ON public.routes FOR ALL TO authenticated USING ((SELECT public.get_current_user_role()) = 'admin');

CREATE POLICY "Public read stops" ON public.stops FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admin write stops" ON public.stops FOR ALL TO authenticated USING ((SELECT public.get_current_user_role()) = 'admin');

CREATE POLICY "Public read trips" ON public.trips FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admin write trips" ON public.trips FOR ALL TO authenticated USING ((SELECT public.get_current_user_role()) = 'admin');

-- --------------------------------------------------------
-- POLICIES FOR: passenger_journeys (User Scoped + Admin Ops)
-- --------------------------------------------------------
CREATE POLICY "Passengers and admins can view journeys" 
ON public.passenger_journeys FOR SELECT 
TO authenticated 
USING ((SELECT auth.uid()) = passenger_id OR (SELECT public.get_current_user_role()) = 'admin');

CREATE POLICY "Passengers can create own journeys" 
ON public.passenger_journeys FOR INSERT 
TO authenticated 
WITH CHECK ((SELECT auth.uid()) = passenger_id);

CREATE POLICY "Passengers and admins can update journeys" 
ON public.passenger_journeys FOR UPDATE 
TO authenticated 
USING ((SELECT auth.uid()) = passenger_id OR (SELECT public.get_current_user_role()) = 'admin')
WITH CHECK ((SELECT auth.uid()) = passenger_id OR (SELECT public.get_current_user_role()) = 'admin');

-- --------------------------------------------------------
-- POLICIES FOR: boarding_events (User/Admin Read, Admin/RPC Write)
-- --------------------------------------------------------
CREATE POLICY "Users and admins can view boarding_events" 
ON public.boarding_events FOR SELECT 
TO authenticated 
USING ((SELECT auth.uid()) = passenger_id OR (SELECT public.get_current_user_role()) = 'admin');

CREATE POLICY "Only admins can directly write boarding_events" 
ON public.boarding_events FOR ALL 
TO authenticated 
USING ((SELECT public.get_current_user_role()) = 'admin');

-- --------------------------------------------------------
-- POLICIES FOR: bus_locations & bus_current_location (Public Read)
-- --------------------------------------------------------
CREATE POLICY "Public read bus_locations" ON public.bus_locations FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admin write bus_locations" ON public.bus_locations FOR ALL TO authenticated USING ((SELECT public.get_current_user_role()) = 'admin');

CREATE POLICY "Public read bus_current_location" ON public.bus_current_location FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "Admin write bus_current_location" ON public.bus_current_location FOR ALL TO authenticated USING ((SELECT public.get_current_user_role()) = 'admin');

-- --------------------------------------------------------
-- POLICIES FOR: device_keys (Admin Only)
-- --------------------------------------------------------
CREATE POLICY "Only admins can manage device_keys" 
ON public.device_keys FOR ALL 
TO authenticated 
USING ((SELECT public.get_current_user_role()) = 'admin');
