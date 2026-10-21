CREATE TABLE public.operations_personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id text NOT NULL UNIQUE CHECK (length(btrim(personnel_id)) > 0),
  full_name text NOT NULL CHECK (length(btrim(full_name)) > 0),
  personnel_type text NOT NULL CHECK (personnel_type IN ('driver', 'conductor', 'dispatcher')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX operations_personnel_type_active_idx
  ON public.operations_personnel (personnel_type, full_name)
  WHERE is_active = true;

ALTER TABLE public.operations_personnel ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operations_personnel TO authenticated;
CREATE POLICY "Admins manage operations personnel"
  ON public.operations_personnel FOR ALL TO authenticated
  USING ((SELECT public.get_current_user_role()) = 'admin')
  WITH CHECK ((SELECT public.get_current_user_role()) = 'admin');

CREATE TRIGGER update_operations_personnel_updated_at
  BEFORE UPDATE ON public.operations_personnel
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
