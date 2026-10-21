REVOKE ALL ON TABLE public.operations_personnel FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.admin_signup_requests FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.operations_personnel TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.admin_signup_requests TO authenticated;
