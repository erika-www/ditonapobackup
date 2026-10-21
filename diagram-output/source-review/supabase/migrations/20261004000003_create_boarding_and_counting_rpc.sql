-- ========================================================
-- 03: PASSENGER COUNTING, BOARDING EVENTS & RPC FUNCTIONS
-- ========================================================

-- 1. Boarding Events Table
CREATE TABLE IF NOT EXISTS public.boarding_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE RESTRICT,
    bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE RESTRICT,
    passenger_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    journey_id UUID REFERENCES public.passenger_journeys(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('board', 'alight')),
    method TEXT NOT NULL CHECK (method IN ('qr', 'dashboard')),
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    idempotency_key TEXT UNIQUE,
    is_reversed BOOLEAN NOT NULL DEFAULT FALSE,
    reversal_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index for active boarding tracking per passenger per trip
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_passenger_board 
ON public.boarding_events (trip_id, passenger_id) 
WHERE event_type = 'board' AND is_reversed = FALSE AND passenger_id IS NOT NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_boarding_events_trip_id ON public.boarding_events(trip_id);
CREATE INDEX IF NOT EXISTS idx_boarding_events_bus_id ON public.boarding_events(bus_id);

-- 2. View for Trip Occupancy Summary
CREATE OR REPLACE VIEW public.trip_occupancy WITH (security_invoker = true) AS
SELECT 
    t.id AS trip_id,
    t.bus_id,
    t.route_id,
    b.plate_number AS bus_plate,
    b.capacity AS bus_capacity,
    COALESCE(COUNT(be.id) FILTER (WHERE be.event_type = 'board' AND be.is_reversed = FALSE), 0)::INTEGER AS total_boarded,
    COALESCE(COUNT(be.id) FILTER (WHERE be.event_type = 'alight' AND be.is_reversed = FALSE), 0)::INTEGER AS total_alighted,
    (COALESCE(COUNT(be.id) FILTER (WHERE be.event_type = 'board' AND be.is_reversed = FALSE), 0) - 
     COALESCE(COUNT(be.id) FILTER (WHERE be.event_type = 'alight' AND be.is_reversed = FALSE), 0))::INTEGER AS current_onboard,
    GREATEST(0, b.capacity - (
     COALESCE(COUNT(be.id) FILTER (WHERE be.event_type = 'board' AND be.is_reversed = FALSE), 0) - 
     COALESCE(COUNT(be.id) FILTER (WHERE be.event_type = 'alight' AND be.is_reversed = FALSE), 0)
    ))::INTEGER AS available_seats
FROM public.trips t
JOIN public.buses b ON b.id = t.bus_id
LEFT JOIN public.boarding_events be ON be.trip_id = t.id
GROUP BY t.id, t.bus_id, t.route_id, b.plate_number, b.capacity;

-- 3. Atomic RPC Function to Record Boarding/Alighting Events
CREATE OR REPLACE FUNCTION public.record_boarding_event(
    p_trip_id UUID,
    p_event_type TEXT,
    p_method TEXT,
    p_passenger_id UUID DEFAULT NULL,
    p_journey_id UUID DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL,
    p_recorded_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_bus_id UUID;
    v_bus_capacity INTEGER;
    v_total_boarded INTEGER;
    v_total_alighted INTEGER;
    v_current_onboard INTEGER;
    v_available_seats INTEGER;
    v_existing_event_id UUID;
    v_new_event_id UUID;
    v_caller_id UUID;
BEGIN
    -- Determine caller ID
    v_caller_id := COALESCE(p_recorded_by, (SELECT auth.uid()));

    -- Check idempotency key first if provided
    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
        SELECT id INTO v_existing_event_id 
        FROM public.boarding_events 
        WHERE idempotency_key = p_idempotency_key LIMIT 1;
        
        IF v_existing_event_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'idempotent', true,
                'event_id', v_existing_event_id,
                'message', 'Duplicate request ignored (idempotent key).'
            );
        END IF;
    END IF;

    -- Validate input event types
    IF p_event_type NOT IN ('board', 'alight') THEN
        RAISE EXCEPTION 'Invalid event_type: %. Must be board or alight.', p_event_type;
    END IF;

    IF p_method NOT IN ('qr', 'dashboard') THEN
        RAISE EXCEPTION 'Invalid method: %. Must be qr or dashboard.', p_method;
    END IF;

    -- Row Lock on Trips and Buses to prevent race conditions
    SELECT bus_id INTO v_bus_id
    FROM public.trips
    WHERE id = p_trip_id
    FOR UPDATE;

    IF v_bus_id IS NULL THEN
        RAISE EXCEPTION 'Trip ID % not found.', p_trip_id;
    END IF;

    SELECT capacity INTO v_bus_capacity
    FROM public.buses
    WHERE id = v_bus_id
    FOR UPDATE;

    -- Calculate current counts under transaction row lock
    SELECT 
        COALESCE(COUNT(*) FILTER (WHERE event_type = 'board' AND is_reversed = FALSE), 0),
        COALESCE(COUNT(*) FILTER (WHERE event_type = 'alight' AND is_reversed = FALSE), 0)
    INTO v_total_boarded, v_total_alighted
    FROM public.boarding_events
    WHERE trip_id = p_trip_id;

    v_current_onboard := v_total_boarded - v_total_alighted;
    v_available_seats := v_bus_capacity - v_current_onboard;

    -- Enforce Boarding Constraints
    IF p_event_type = 'board' THEN
        IF v_available_seats <= 0 THEN
            RAISE EXCEPTION 'Boarding rejected: Bus capacity reached (0 available seats).';
        END IF;

        -- Check if passenger is already boarded on this trip without alighting
        IF p_passenger_id IS NOT NULL THEN
            IF EXISTS (
                SELECT 1 FROM public.boarding_events
                WHERE trip_id = p_trip_id 
                  AND passenger_id = p_passenger_id 
                  AND event_type = 'board' 
                  AND is_reversed = FALSE
            ) THEN
                RAISE EXCEPTION 'Passenger is already boarded on this trip.';
            END IF;
        END IF;

        v_current_onboard := v_current_onboard + 1;
        v_available_seats := v_available_seats - 1;

    ELSIF p_event_type = 'alight' THEN
        IF v_current_onboard <= 0 THEN
            RAISE EXCEPTION 'Alighting rejected: Current onboard count cannot drop below zero.';
        END IF;

        v_current_onboard := v_current_onboard - 1;
        v_available_seats := v_available_seats + 1;
    END IF;

    -- Insert Boarding Event
    INSERT INTO public.boarding_events (
        trip_id,
        bus_id,
        passenger_id,
        journey_id,
        event_type,
        method,
        recorded_by,
        idempotency_key
    )
    VALUES (
        p_trip_id,
        v_bus_id,
        p_passenger_id,
        p_journey_id,
        p_event_type,
        p_method,
        v_caller_id,
        p_idempotency_key
    )
    RETURNING id INTO v_new_event_id;

    -- Update Passenger Journey status if applicable
    IF p_journey_id IS NOT NULL THEN
        IF p_event_type = 'board' THEN
            UPDATE public.passenger_journeys
            SET status = 'boarded', trip_id = p_trip_id, updated_at = NOW()
            WHERE id = p_journey_id;
        ELSIF p_event_type = 'alight' THEN
            UPDATE public.passenger_journeys
            SET status = 'completed', updated_at = NOW()
            WHERE id = p_journey_id;
        END IF;
    ELSIF p_passenger_id IS NOT NULL THEN
        IF p_event_type = 'board' THEN
            UPDATE public.passenger_journeys
            SET status = 'boarded', trip_id = p_trip_id, updated_at = NOW()
            WHERE passenger_id = p_passenger_id AND status = 'planned';
        ELSIF p_event_type = 'alight' THEN
            UPDATE public.passenger_journeys
            SET status = 'completed', updated_at = NOW()
            WHERE passenger_id = p_passenger_id AND status = 'boarded';
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'event_id', v_new_event_id,
        'current_onboard', v_current_onboard,
        'available_seats', v_available_seats,
        'bus_capacity', v_bus_capacity
    );
END;
$$;

-- 4. RPC Function for Admin Correction / Reversal of Mistaken Entries
CREATE OR REPLACE FUNCTION public.correct_boarding_event(
    p_event_id UUID,
    p_reversal_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_event RECORD;
    v_caller_role TEXT;
BEGIN
    -- Enforce admin privilege
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = (SELECT auth.uid());
    IF v_caller_role <> 'admin' THEN
        RAISE EXCEPTION 'Unauthorized: Only admins can correct boarding entries.';
    END IF;

    SELECT * INTO v_event FROM public.boarding_events WHERE id = p_event_id FOR UPDATE;
    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Event ID % not found.', p_event_id;
    END IF;

    IF v_event.is_reversed THEN
        RAISE EXCEPTION 'Event ID % is already reversed.', p_event_id;
    END IF;

    UPDATE public.boarding_events
    SET is_reversed = TRUE,
        reversal_reason = p_reversal_reason
    WHERE id = p_event_id;

    RETURN jsonb_build_object(
        'success', true,
        'event_id', p_event_id,
        'message', 'Boarding event successfully reversed with audit record.'
    );
END;
$$;

-- 5. Reconciliation Check View
CREATE OR REPLACE VIEW public.occupancy_reconciliation WITH (security_invoker = true) AS
SELECT 
    t.id AS trip_id,
    b.plate_number,
    b.capacity,
    COALESCE(COUNT(be.id) FILTER (WHERE be.event_type = 'board' AND be.is_reversed = FALSE), 0) AS total_boarded,
    COALESCE(COUNT(be.id) FILTER (WHERE be.event_type = 'alight' AND be.is_reversed = FALSE), 0) AS total_alighted,
    (COALESCE(COUNT(be.id) FILTER (WHERE be.event_type = 'board' AND be.is_reversed = FALSE), 0) - 
     COALESCE(COUNT(be.id) FILTER (WHERE be.event_type = 'alight' AND be.is_reversed = FALSE), 0)) AS current_onboard,
    CASE 
        WHEN (COALESCE(COUNT(be.id) FILTER (WHERE be.event_type = 'board' AND be.is_reversed = FALSE), 0) - 
              COALESCE(COUNT(be.id) FILTER (WHERE be.event_type = 'alight' AND be.is_reversed = FALSE), 0)) < 0 THEN 'MISMATCH_NEGATIVE_ONBOARD'
        WHEN (COALESCE(COUNT(be.id) FILTER (WHERE be.event_type = 'board' AND be.is_reversed = FALSE), 0) - 
              COALESCE(COUNT(be.id) FILTER (WHERE be.event_type = 'alight' AND be.is_reversed = FALSE), 0)) > b.capacity THEN 'MISMATCH_EXCEEDS_CAPACITY'
        ELSE 'BALANCED'
    END AS reconciliation_status
FROM public.trips t
JOIN public.buses b ON b.id = t.bus_id
LEFT JOIN public.boarding_events be ON be.trip_id = t.id
GROUP BY t.id, b.plate_number, b.capacity;
