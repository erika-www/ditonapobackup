-- Keep personnel operations readable to authenticated duty users and admins.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.operations_personnel TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.admin_signup_requests TO authenticated;

ALTER TABLE public.operations_personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_signup_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read operations personnel" ON public.operations_personnel;
CREATE POLICY "Authenticated users can read operations personnel"
  ON public.operations_personnel FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users and admins can view admin signup requests" ON public.admin_signup_requests;
CREATE POLICY "Users and admins can view admin signup requests"
  ON public.admin_signup_requests FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.get_current_user_role()) = 'admin');

DROP POLICY IF EXISTS "Admins can review admin signup requests" ON public.admin_signup_requests;
CREATE POLICY "Admins can review admin signup requests"
  ON public.admin_signup_requests FOR UPDATE TO authenticated
  USING ((SELECT public.get_current_user_role()) = 'admin')
  WITH CHECK ((SELECT public.get_current_user_role()) = 'admin');

NOTIFY pgrst, 'reload schema';
