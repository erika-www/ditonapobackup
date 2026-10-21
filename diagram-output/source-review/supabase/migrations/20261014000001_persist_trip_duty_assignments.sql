ALTER TABLE public.trips
  ADD COLUMN driver_personnel_id text REFERENCES public.operations_personnel(personnel_id) ON DELETE RESTRICT,
  ADD COLUMN conductor_personnel_id text REFERENCES public.operations_personnel(personnel_id) ON DELETE RESTRICT,
  ADD COLUMN dispatcher_personnel_id text REFERENCES public.operations_personnel(personnel_id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.start_or_resume_trip_for_bus(
  p_bus_id uuid,
  p_route_id uuid,
  p_driver_personnel_id text,
  p_conductor_personnel_id text,
  p_dispatcher_personnel_id text DEFAULT NULL
)
RETURNS public.trips
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_day_start timestamptz := date_trunc('day', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila';
BEGIN
  IF (SELECT public.get_current_user_role()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can start an operational trip.';
  END IF;

  IF p_driver_personnel_id IS NULL OR p_conductor_personnel_id IS NULL THEN
    RAISE EXCEPTION 'Select an active driver and conductor before starting the trip.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.operations_personnel
    WHERE personnel_id = p_driver_personnel_id AND personnel_type = 'driver' AND is_active
  ) OR NOT EXISTS (
    SELECT 1 FROM public.operations_personnel
    WHERE personnel_id = p_conductor_personnel_id AND personnel_type = 'conductor' AND is_active
  ) THEN
    RAISE EXCEPTION 'The selected driver or conductor is no longer active. Refresh the personnel list.';
  END IF;

  IF p_dispatcher_personnel_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.operations_personnel
    WHERE personnel_id = p_dispatcher_personnel_id AND personnel_type = 'dispatcher' AND is_active
  ) THEN
    RAISE EXCEPTION 'The selected dispatcher is no longer active. Refresh the personnel list.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_bus_id::text, 0));

  UPDATE public.trips
  SET status = 'completed', ended_at = COALESCE(ended_at, now())
  WHERE bus_id = p_bus_id AND status = 'ongoing' AND started_at < v_day_start;

  SELECT * INTO v_trip
  FROM public.trips
  WHERE bus_id = p_bus_id AND status = 'ongoing' AND started_at >= v_day_start
  ORDER BY started_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.trips
    SET driver_personnel_id = p_driver_personnel_id,
        conductor_personnel_id = p_conductor_personnel_id,
        dispatcher_personnel_id = p_dispatcher_personnel_id
    WHERE id = v_trip.id
    RETURNING * INTO v_trip;
    RETURN v_trip;
  END IF;

  INSERT INTO public.trips (
    bus_id, route_id, status, started_at,
    driver_personnel_id, conductor_personnel_id, dispatcher_personnel_id
  ) VALUES (
    p_bus_id, p_route_id, 'ongoing', now(),
    p_driver_personnel_id, p_conductor_personnel_id, p_dispatcher_personnel_id
  ) RETURNING * INTO v_trip;

  RETURN v_trip;
END;
$function$;

REVOKE ALL ON FUNCTION public.start_or_resume_trip_for_bus(uuid, uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_or_resume_trip_for_bus(uuid, uuid, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
