-- The personnel client evaluates passenger journey policies while inserting
-- manual or hardware-scanned journeys. Keep the role helper callable by the
-- authenticated personnel session so RLS can evaluate those policies.
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

NOTIFY pgrst, 'reload schema';
