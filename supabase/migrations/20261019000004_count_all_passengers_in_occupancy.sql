-- Occupancy must count every traveler represented by a boarding pass, including
-- companions, while retaining one auditable boarding event per scanned pass.
CREATE OR REPLACE VIEW public.trip_occupancy WITH (security_invoker = true) AS
SELECT
  t.id AS trip_id,
  t.bus_id,
  t.route_id,
  b.plate_number AS bus_plate,
  b.capacity AS bus_capacity,
  COALESCE(SUM(
    CASE WHEN be.event_type = 'board' AND NOT be.is_reversed
      THEN GREATEST(1, COALESCE(pj.passenger_count, 1)) ELSE 0 END
  ), 0)::integer AS total_boarded,
  COALESCE(SUM(
    CASE WHEN be.event_type = 'alight' AND NOT be.is_reversed
      THEN GREATEST(1, COALESCE(pj.passenger_count, 1)) ELSE 0 END
  ), 0)::integer AS total_alighted,
  (
    COALESCE(SUM(CASE WHEN be.event_type = 'board' AND NOT be.is_reversed
      THEN GREATEST(1, COALESCE(pj.passenger_count, 1)) ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN be.event_type = 'alight' AND NOT be.is_reversed
      THEN GREATEST(1, COALESCE(pj.passenger_count, 1)) ELSE 0 END), 0)
  )::integer AS current_onboard,
  GREATEST(0, b.capacity - (
    COALESCE(SUM(CASE WHEN be.event_type = 'board' AND NOT be.is_reversed
      THEN GREATEST(1, COALESCE(pj.passenger_count, 1)) ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN be.event_type = 'alight' AND NOT be.is_reversed
      THEN GREATEST(1, COALESCE(pj.passenger_count, 1)) ELSE 0 END), 0)
  ))::integer AS available_seats,
  GREATEST(0, (
    COALESCE(SUM(CASE WHEN be.event_type = 'board' AND NOT be.is_reversed
      THEN GREATEST(1, COALESCE(pj.passenger_count, 1)) ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN be.event_type = 'alight' AND NOT be.is_reversed
      THEN GREATEST(1, COALESCE(pj.passenger_count, 1)) ELSE 0 END), 0)
    - b.capacity
  ))::integer AS standing_passengers
FROM public.trips AS t
JOIN public.buses AS b ON b.id = t.bus_id
LEFT JOIN public.boarding_events AS be ON be.trip_id = t.id
LEFT JOIN public.passenger_journeys AS pj ON pj.id = be.journey_id
GROUP BY t.id, t.bus_id, t.route_id, b.plate_number, b.capacity;

GRANT SELECT ON public.trip_occupancy TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
