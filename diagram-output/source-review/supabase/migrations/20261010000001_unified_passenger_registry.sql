-- Keep every passenger, whether registered in the passenger app or by staff,
-- as an individual journey linked to the bus trip they actually board.
ALTER TABLE public.passenger_journeys
  ALTER COLUMN passenger_id DROP NOT NULL;

ALTER TABLE public.passenger_journeys
  ADD COLUMN IF NOT EXISTS trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS passenger_name text,
  ADD COLUMN IF NOT EXISTS registration_source text NOT NULL DEFAULT 'app'
    CHECK (registration_source IN ('app', 'admin')),
  ADD COLUMN IF NOT EXISTS boarded_at timestamptz,
  ADD COLUMN IF NOT EXISTS alighted_at timestamptz;

UPDATE public.passenger_journeys
SET passenger_name = p.full_name
FROM public.profiles AS p
WHERE passenger_journeys.passenger_id = p.id
  AND passenger_journeys.passenger_name IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'passenger_journeys_identity_check'
      AND conrelid = 'public.passenger_journeys'::regclass
  ) THEN
    ALTER TABLE public.passenger_journeys
      ADD CONSTRAINT passenger_journeys_identity_check
      CHECK (passenger_id IS NOT NULL OR NULLIF(btrim(passenger_name), '') IS NOT NULL);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_passenger_journeys_trip_created
  ON public.passenger_journeys (trip_id, created_at);

DROP POLICY IF EXISTS "Passengers and admins can view journeys" ON public.passenger_journeys;
DROP POLICY IF EXISTS passenger_journeys_select_own ON public.passenger_journeys;
CREATE POLICY passenger_journeys_select_own_or_admin
  ON public.passenger_journeys FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = passenger_id
    OR (SELECT public.get_current_user_role()) = 'admin');

DROP POLICY IF EXISTS "Passengers can create own journeys" ON public.passenger_journeys;
DROP POLICY IF EXISTS passenger_journeys_insert_own ON public.passenger_journeys;
CREATE POLICY passenger_journeys_insert_app_or_admin
  ON public.passenger_journeys FOR INSERT TO authenticated
  WITH CHECK (
    ((SELECT auth.uid()) = passenger_id AND registration_source = 'app')
    OR ((SELECT public.get_current_user_role()) = 'admin' AND registration_source = 'admin')
  );

DROP POLICY IF EXISTS "Passengers and admins can update journeys" ON public.passenger_journeys;
DROP POLICY IF EXISTS passenger_journeys_update_own ON public.passenger_journeys;
CREATE POLICY passenger_journeys_update_own_or_admin
  ON public.passenger_journeys FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = passenger_id
    OR (SELECT public.get_current_user_role()) = 'admin')
  WITH CHECK ((SELECT auth.uid()) = passenger_id
    OR (SELECT public.get_current_user_role()) = 'admin');

GRANT SELECT, INSERT, UPDATE ON public.passenger_journeys TO authenticated;

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
    v_caller_id := COALESCE(p_recorded_by, (SELECT auth.uid()));
    IF (SELECT public.get_current_user_role()) IS DISTINCT FROM 'admin' THEN
      RAISE EXCEPTION 'Only admins can record passenger boarding events.';
    END IF;

    IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
      SELECT id INTO v_existing_event_id FROM public.boarding_events
      WHERE idempotency_key = p_idempotency_key LIMIT 1;
      IF v_existing_event_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'idempotent', true, 'event_id', v_existing_event_id);
      END IF;
    END IF;

    IF p_event_type NOT IN ('board', 'alight') THEN RAISE EXCEPTION 'Invalid event type.'; END IF;
    IF p_method NOT IN ('qr', 'dashboard') THEN RAISE EXCEPTION 'Invalid event method.'; END IF;

    IF p_journey_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.passenger_journeys j
      WHERE j.id = p_journey_id
        AND ((p_event_type = 'board' AND j.status = 'planned'
              AND (j.trip_id IS NULL OR j.trip_id = p_trip_id))
          OR (p_event_type = 'alight' AND j.status = 'boarded' AND j.trip_id = p_trip_id))
      FOR UPDATE
    ) THEN
      RAISE EXCEPTION 'Passenger journey is not eligible for this event on this trip.';
    END IF;

    SELECT bus_id INTO v_bus_id FROM public.trips WHERE id = p_trip_id FOR UPDATE;
    IF v_bus_id IS NULL THEN RAISE EXCEPTION 'Trip ID % not found.', p_trip_id; END IF;
    SELECT capacity INTO v_bus_capacity FROM public.buses WHERE id = v_bus_id FOR UPDATE;

    SELECT count(*) FILTER (WHERE event_type = 'board' AND NOT is_reversed),
           count(*) FILTER (WHERE event_type = 'alight' AND NOT is_reversed)
      INTO v_total_boarded, v_total_alighted
      FROM public.boarding_events WHERE trip_id = p_trip_id;
    v_current_onboard := v_total_boarded - v_total_alighted;
    v_available_seats := v_bus_capacity - v_current_onboard;

    IF p_event_type = 'board' THEN
      IF v_available_seats <= 0 THEN RAISE EXCEPTION 'Boarding rejected: bus is full.'; END IF;
      IF p_passenger_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.boarding_events WHERE trip_id = p_trip_id
          AND passenger_id = p_passenger_id AND event_type = 'board' AND NOT is_reversed
      ) THEN RAISE EXCEPTION 'Passenger is already boarded on this trip.'; END IF;
      v_current_onboard := v_current_onboard + 1;
      v_available_seats := v_available_seats - 1;
    ELSE
      IF v_current_onboard <= 0 THEN RAISE EXCEPTION 'Alighting rejected: no passengers onboard.'; END IF;
      v_current_onboard := v_current_onboard - 1;
      v_available_seats := v_available_seats + 1;
    END IF;

    INSERT INTO public.boarding_events (
      trip_id, bus_id, passenger_id, journey_id, event_type, method, recorded_by, idempotency_key
    ) VALUES (
      p_trip_id, v_bus_id, p_passenger_id, p_journey_id, p_event_type,
      p_method, v_caller_id, p_idempotency_key
    ) RETURNING id INTO v_new_event_id;

    IF p_journey_id IS NOT NULL THEN
      IF p_event_type = 'board' THEN
        UPDATE public.passenger_journeys SET status = 'boarded', trip_id = p_trip_id,
          boarded_at = COALESCE(boarded_at, now()), updated_at = now() WHERE id = p_journey_id;
      ELSE
        UPDATE public.passenger_journeys SET status = 'completed',
          alighted_at = COALESCE(alighted_at, now()), updated_at = now() WHERE id = p_journey_id;
      END IF;
    ELSIF p_passenger_id IS NOT NULL THEN
      IF p_event_type = 'board' THEN
        UPDATE public.passenger_journeys SET status = 'boarded', trip_id = p_trip_id,
          boarded_at = COALESCE(boarded_at, now()), updated_at = now()
          WHERE passenger_id = p_passenger_id AND status = 'planned';
      ELSE
        UPDATE public.passenger_journeys SET status = 'completed',
          alighted_at = COALESCE(alighted_at, now()), updated_at = now()
          WHERE passenger_id = p_passenger_id AND status = 'boarded' AND trip_id = p_trip_id;
      END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'event_id', v_new_event_id,
      'current_onboard', v_current_onboard, 'available_seats', v_available_seats,
      'bus_capacity', v_bus_capacity);
END;
$$;

REVOKE ALL ON FUNCTION public.record_boarding_event(UUID, TEXT, TEXT, UUID, UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_boarding_event(UUID, TEXT, TEXT, UUID, UUID, TEXT, UUID) TO authenticated;
NOTIFY pgrst, 'reload schema';
