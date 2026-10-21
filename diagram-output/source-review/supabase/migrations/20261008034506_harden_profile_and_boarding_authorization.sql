-- Keep passenger-managed profile fields separate from database-owned roles.
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
	SELECT p.role
	FROM public.profiles AS p
	WHERE p.id = (SELECT auth.uid())
	LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (
	(SELECT auth.uid()) = id
	AND role = 'passenger'
);

DROP POLICY IF EXISTS "Users can update own profile except role" ON public.profiles;
CREATE POLICY "Users can update own profile except role"
ON public.profiles FOR UPDATE
TO authenticated
USING ((SELECT auth.uid()) = id)
WITH CHECK (
	(SELECT auth.uid()) = id
	AND role = (SELECT public.get_current_user_role())
);

-- Security-definer RPCs must not be callable without an authenticated session.
REVOKE ALL ON FUNCTION public.record_boarding_event(UUID, TEXT, TEXT, UUID, UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_boarding_event(UUID, TEXT, TEXT, UUID, UUID, TEXT, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.correct_boarding_event(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.correct_boarding_event(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_boarding_event_actor()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
	v_user_id UUID := (SELECT auth.uid());
	v_role TEXT := (SELECT public.get_current_user_role());
BEGIN
	IF v_user_id IS NULL THEN
		RAISE EXCEPTION 'Authentication is required to record a boarding event.';
	END IF;

	IF NEW.recorded_by IS DISTINCT FROM v_user_id THEN
		RAISE EXCEPTION 'The recorded_by identity must match the authenticated user.';
	END IF;

	IF v_role IS DISTINCT FROM 'admin' THEN
		IF NEW.passenger_id IS DISTINCT FROM v_user_id THEN
			RAISE EXCEPTION 'Passengers must identify themselves and may only record their own boarding events.';
		END IF;

		IF NEW.journey_id IS NOT NULL AND NOT EXISTS (
			SELECT 1
			FROM public.passenger_journeys AS j
			WHERE j.id = NEW.journey_id
			  AND j.passenger_id = v_user_id
		) THEN
			RAISE EXCEPTION 'Passengers may only attach their own journey.';
		END IF;
	END IF;

	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_boarding_event_actor ON public.boarding_events;
CREATE TRIGGER validate_boarding_event_actor
BEFORE INSERT ON public.boarding_events
FOR EACH ROW EXECUTE FUNCTION public.validate_boarding_event_actor();

CREATE OR REPLACE FUNCTION public.require_admin_for_boarding_correction()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
	IF (SELECT auth.uid()) IS NULL
	   OR (SELECT public.get_current_user_role()) IS DISTINCT FROM 'admin' THEN
		RAISE EXCEPTION 'Only an authenticated admin can correct boarding events.';
	END IF;

	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_admin_for_boarding_correction ON public.boarding_events;
CREATE TRIGGER require_admin_for_boarding_correction
BEFORE UPDATE ON public.boarding_events
FOR EACH ROW EXECUTE FUNCTION public.require_admin_for_boarding_correction();

REVOKE ALL ON FUNCTION public.validate_boarding_event_actor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_admin_for_boarding_correction() FROM PUBLIC, anon, authenticated;
