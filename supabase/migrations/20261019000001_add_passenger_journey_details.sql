-- Preserve the passenger selections needed to render and validate a boarding pass.
ALTER TABLE public.passenger_journeys
  ADD COLUMN IF NOT EXISTS passenger_category TEXT DEFAULT 'Regular',
  ADD COLUMN IF NOT EXISTS passenger_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS companions INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.passenger_journeys
  DROP CONSTRAINT IF EXISTS passenger_journeys_passenger_count_check,
  DROP CONSTRAINT IF EXISTS passenger_journeys_companions_check;

ALTER TABLE public.passenger_journeys
  ADD CONSTRAINT passenger_journeys_passenger_count_check CHECK (passenger_count >= 1),
  ADD CONSTRAINT passenger_journeys_companions_check CHECK (companions >= 0 AND companions < passenger_count);

NOTIFY pgrst, 'reload schema';
