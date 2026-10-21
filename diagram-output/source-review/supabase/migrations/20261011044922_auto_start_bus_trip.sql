CREATE OR REPLACE FUNCTION public.start_or_resume_trip_for_bus(p_bus_id uuid, p_route_id uuid)
RETURNS public.trips
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_trip public.trips%ROWTYPE;
BEGIN
  IF (SELECT public.get_current_user_role()) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins can start an operational trip.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_bus_id::text, 0));

  SELECT * INTO v_trip
  FROM public.trips
  WHERE bus_id = p_bus_id AND status = 'ongoing'
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

REVOKE ALL ON FUNCTION public.start_or_resume_trip_for_bus(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_or_resume_trip_for_bus(uuid, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
