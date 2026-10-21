CREATE OR REPLACE FUNCTION public.start_or_resume_trip_for_bus(p_bus_id uuid, p_route_id uuid)
RETURNS public.trips
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_day_start TIMESTAMPTZ := date_trunc('day', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila';
BEGIN
  IF (SELECT public.get_current_user_role()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can start an operational trip.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_bus_id::text, 0));

  -- A new duty registration starts a new daily run; close any trip left open
  -- from an earlier service day before looking for today's trip.
  UPDATE public.trips
  SET status = 'completed', ended_at = COALESCE(ended_at, now())
  WHERE bus_id = p_bus_id
    AND status = 'ongoing'
    AND started_at < v_day_start;

  SELECT * INTO v_trip
  FROM public.trips
  WHERE bus_id = p_bus_id
    AND status = 'ongoing'
    AND started_at >= v_day_start
  ORDER BY started_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    RETURN v_trip;
  END IF;

  INSERT INTO public.trips (bus_id, route_id, status, started_at)
  VALUES (p_bus_id, p_route_id, 'ongoing', now())
  RETURNING * INTO v_trip;

  RETURN v_trip;
END;
$function$;

NOTIFY pgrst, 'reload schema';
