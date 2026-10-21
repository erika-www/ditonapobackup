-- Add the passenger journey table required by the passenger app.
-- This is intentionally independent of the legacy public.trips table, whose
-- schema predates the operational schema migration.
CREATE TABLE IF NOT EXISTS public.passenger_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  origin_name text NOT NULL,
  origin_lat double precision,
  origin_lng double precision,
  destination_name text NOT NULL,
  destination_lat double precision,
  destination_lng double precision,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'boarded', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_passenger_journeys_passenger_created
  ON public.passenger_journeys (passenger_id, created_at DESC);

ALTER TABLE public.passenger_journeys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS passenger_journeys_select_own ON public.passenger_journeys;
CREATE POLICY passenger_journeys_select_own
  ON public.passenger_journeys FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = passenger_id);

DROP POLICY IF EXISTS passenger_journeys_insert_own ON public.passenger_journeys;
CREATE POLICY passenger_journeys_insert_own
  ON public.passenger_journeys FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = passenger_id);

DROP POLICY IF EXISTS passenger_journeys_update_own ON public.passenger_journeys;
CREATE POLICY passenger_journeys_update_own
  ON public.passenger_journeys FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = passenger_id)
  WITH CHECK ((SELECT auth.uid()) = passenger_id);

GRANT SELECT, INSERT, UPDATE ON public.passenger_journeys TO authenticated;

NOTIFY pgrst, 'reload schema';
