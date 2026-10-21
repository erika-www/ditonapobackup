ALTER TABLE public.passenger_journeys
  ADD COLUMN IF NOT EXISTS qr_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS feedback_rating smallint CHECK (feedback_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS feedback_text text;

GRANT UPDATE (feedback_rating, feedback_text) ON public.passenger_journeys TO authenticated;
NOTIFY pgrst, 'reload schema';
