CREATE TABLE public.operations_personnel_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id text NOT NULL CHECK (length(btrim(personnel_id)) BETWEEN 1 AND 80),
  full_name text NOT NULL CHECK (length(btrim(full_name)) BETWEEN 1 AND 160),
  personnel_type text NOT NULL CHECK (personnel_type IN ('driver', 'conductor', 'dispatcher')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX operations_personnel_requests_pending_idx
  ON public.operations_personnel_requests (requested_at)
  WHERE status = 'pending';

ALTER TABLE public.operations_personnel_requests ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.operations_personnel_requests TO anon, authenticated;
GRANT SELECT, UPDATE ON public.operations_personnel_requests TO authenticated;

CREATE POLICY "Anyone can submit a pending personnel registration request"
  ON public.operations_personnel_requests FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending');

CREATE POLICY "Admins can view personnel registration requests"
  ON public.operations_personnel_requests FOR SELECT TO authenticated
  USING ((SELECT public.get_current_user_role()) = 'admin');

CREATE POLICY "Admins can review personnel registration requests"
  ON public.operations_personnel_requests FOR UPDATE TO authenticated
  USING ((SELECT public.get_current_user_role()) = 'admin')
  WITH CHECK ((SELECT public.get_current_user_role()) = 'admin');

CREATE OR REPLACE FUNCTION public.review_operations_personnel_request(
  p_request_id uuid,
  p_approve boolean
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  request_row public.operations_personnel_requests%ROWTYPE;
  result_status text;
BEGIN
  IF public.get_current_user_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Administrator access required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO request_row
  FROM public.operations_personnel_requests
  WHERE id = p_request_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This personnel request is no longer pending.' USING ERRCODE = 'P0002';
  END IF;

  IF p_approve THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(lower(request_row.personnel_id), 0));
    IF EXISTS (
      SELECT 1 FROM public.operations_personnel
      WHERE lower(personnel_id) = lower(request_row.personnel_id)
    ) THEN
      RAISE EXCEPTION 'That personnel ID is already registered.' USING ERRCODE = '23505';
    END IF;

    INSERT INTO public.operations_personnel (personnel_id, full_name, personnel_type)
    VALUES (btrim(request_row.personnel_id), btrim(request_row.full_name), request_row.personnel_type);
    result_status := 'approved';
  ELSE
    result_status := 'rejected';
  END IF;

  UPDATE public.operations_personnel_requests
  SET status = result_status, reviewed_at = now(), reviewed_by = auth.uid()
  WHERE id = request_row.id;

  RETURN result_status;
END;
$$;

REVOKE ALL ON FUNCTION public.review_operations_personnel_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_operations_personnel_request(uuid, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
