-- Add the trip identifier used by the registry without assuming that the
-- deployed public.trips table has the newer UUID `id` key. Older deployments
-- use a text `tripID` key, so an FK to public.trips(id) would fail here.
ALTER TABLE public.passenger_journeys
  ADD COLUMN IF NOT EXISTS trip_id uuid;

CREATE INDEX IF NOT EXISTS idx_passenger_journeys_trip_created
  ON public.passenger_journeys (trip_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.passenger_journeys TO authenticated;

NOTIFY pgrst, 'reload schema';
