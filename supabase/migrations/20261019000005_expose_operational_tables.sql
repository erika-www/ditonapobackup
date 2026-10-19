-- Supabase projects created after the Data API exposure change do not grant
-- table access automatically. RLS still decides which rows each role may use.
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON TABLE
  public.buses,
  public.routes,
  public.stops,
  public.trips
TO anon;

GRANT SELECT, INSERT, UPDATE ON TABLE
  public.buses,
  public.routes,
  public.stops,
  public.trips
TO authenticated;

-- The duty RPC is SECURITY INVOKER, so its caller needs the same underlying
-- table privileges. Only authenticated admins pass the function check/RLS.
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_or_resume_trip_for_bus(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_or_resume_trip_for_bus(uuid, uuid, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
