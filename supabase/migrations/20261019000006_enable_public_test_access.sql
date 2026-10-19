-- TEST ENVIRONMENTS ONLY.
-- This migration intentionally makes the public schema fully accessible with
-- the anon key so every personnel-app feature can be exercised without login.
-- Never apply this migration to a production database containing real data.

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;

DO $test_access$
DECLARE
  table_record record;
BEGIN
  FOR table_record IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', table_record.schemaname, table_record.tablename);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 'Testing mode unrestricted access', table_record.schemaname, table_record.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
      'Testing mode unrestricted access', table_record.schemaname, table_record.tablename
    );
  END LOOP;
END
$test_access$;

-- Existing RPC authorization checks call this helper. In the test database,
-- anonymous callers deliberately receive the admin role.
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = (SELECT auth.uid()) LIMIT 1),
    'admin'
  );
$function$;

NOTIFY pgrst, 'reload schema';
