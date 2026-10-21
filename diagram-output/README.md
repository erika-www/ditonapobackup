# DITO NA PO diagrams

Source: `dito-na-po-wa - backup (5).zip`, supplied by the user. These diagrams describe source code and migrations, not a verified running deployment. No application configuration or database was changed.

## Files

1. **01-system-architecture** — applications, cloud services, backend, and onboard hardware.
2. **02-process-passenger-boarding** — planning, QR issuance, scanning, boarding/alighting, and status synchronization.
3. **03-process-gps-announcements** — local GPS announcement path and cloud location path.
4. **04-software-component-design** — component responsibilities and dependencies.
5. **05-software-data-design** — selected Supabase entities and foreign-key relationships.

Each diagram is supplied as SVG (scalable vector), PNG (image), and Mermaid `.mmd` (editable source). SVGs and Mermaid are independently editable representations of the same subject; the Mermaid versions include some finer branches that the presentation SVGs summarize. Open `index.html` for the complete illustrated gallery. Use the browser print command to print one diagram per page.

## Interpretation notes

- The top-level project copy is used. The ZIP also includes an older nested `dito-na-po-wa/` copy with differences, including fewer shared services and Edge Functions. The diagrams do not merge both snapshots.
- Both web apps use Supabase directly. They also contain REST clients for the included FastAPI backend. A single deployment/database shared by those paths cannot be established from the source alone.
- Supabase relationships are based on `supabase/migrations/`, including later changes, rather than treating FastAPI ORM classes as the Supabase schema.
- The local personnel-to-announcer path is `busAnnouncerBridge.js` → Pi 4B `bridge.py` → Pi 3B `web.py` / `TripTracker`. A `bus-direction` cloud endpoint and device poller are included, but no web-app invocation of that cloud endpoint was found.
- Random Forest training produces static JSON/JavaScript prediction assets for browser lookup. The archive does not show an online prediction service.
- Map rendering uses Leaflet/OpenStreetMap. Google Distance Matrix is conditional on the browser SDK being available; ETA calculation has a local fallback.
- GPS thresholds are configurable. The included defaults are approach 140 m, arrive 5 m, depart 20 m (5 + 15), and pass margin 50 m. Individual stops may override them.
- `ingest-gps` authenticates a device, checks rate/coordinates/time, inserts history, and then upserts current location. Those two writes are separate operations.
- Local test branches are present and use browser storage / direct table operations. Production and test behavior should not be assumed identical.
- Current occupancy is defined by the latest `trip_occupancy` view: non-reversed boarding/alighting events weighted by the journey's passenger count, including companions. Frontend priority/regular seat calculations are separate from that view.
- The unified passenger registry migration permits nullable passenger ownership for manual journeys. Local test branches also support anonymous journeys. Optional journey/trip links are represented accordingly. The data diagram is selective, not a complete database schema.

## Source map

All paths below are relative to the top-level project inside the supplied archive.

| Diagram | Main source evidence |
|---|---|
| Architecture | `passenger-app/src/services/{supabaseClient,api,googleMapsService}.js`; `personnel-app/src/services/{supabaseClient,api,busAnnouncerBridge}.js`; `backend/app/main.py`; `backend/app/core/database.py`; `bus_announcer/main.py`; `bus_announcer/raspi4b connec/bridge.py`; `supabase/functions/` |
| Journey and boarding | `passenger-app/src/components/StartTripInterface.jsx`; `personnel-app/src/pages/{PassengerCheckInPage,RouteInformationPage}.jsx`; both `services/supabaseClient.js`; `shared/{qrPassUtils,route4Stops}.js` |
| GPS and announcements | `bus_announcer/{gps_reader,main,tracker,audio_manager,display,sender,web}.py`; `bus_announcer/config.json`; bridge `bridge.py`; `supabase/functions/ingest-gps/index.ts` |
| Software components | Both apps' `src/` trees; `shared/`; `train_random_forest.py`; `backend/app/{api,models,schemas,core}/`; `bus_announcer/` |
| Data relationships | `supabase/migrations/2026100400000{1,2,3,4}_*.sql`; `20261010000001_unified_passenger_registry.sql`; personnel and duty-assignment migrations; `20261018000001_create_bus_commands.sql`; `20261019000004_count_all_passengers_in_occupancy.sql`; `20261019000006_enable_public_test_access.sql` |
