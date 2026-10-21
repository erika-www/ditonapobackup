-- ========================================================
-- SEED DATA FOR QUEZON CITY BUS TRANSIT SYSTEM
-- ========================================================

-- Insert QC Bus Route 4
INSERT INTO public.routes (id, code, name, description, origin_stop_name, destination_stop_name, est_minutes)
VALUES (
    '00000000-0000-0000-0000-000000000004',
    'ROUTE-4',
    'QC Bus Route 4 (QC Hall - Novaliches via Mindanao Ave)',
    'Quezon City Bus Transit Route 4 connecting QC Hall interchange to Novaliches Bayan via Mindanao Avenue.',
    'Quezon City Hall – NHA Interchange',
    'General Luis Avenue corner SB Road Terminal',
    45
) ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

-- Insert Stops for Route 4
INSERT INTO public.stops (id, route_id, sequence_number, name, latitude, longitude)
VALUES
('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000004', 1, 'Quezon City Hall – NHA Interchange', 14.65022, 121.05202),
('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000004', 2, 'North Avenue – Veterans Hospital / Vertis North', 14.65485, 121.04215),
('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000004', 3, 'Mindanao Avenue corner Congressional Avenue', 14.66412, 121.03248),
('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000004', 4, 'Mindanao Avenue corner Tandang Sora Avenue', 14.67825, 121.02891),
('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000004', 5, 'Quirino Highway – SM City Novaliches', 14.70451, 121.03588)
ON CONFLICT (route_id, sequence_number) DO UPDATE SET name = EXCLUDED.name;

-- Insert Fleet Buses
INSERT INTO public.buses (id, plate_number, capacity, status)
VALUES 
('00000000-0000-0000-0000-000000000402', 'QC-BUS-0402', 50, 'active'),
('00000000-0000-0000-0000-000000000401', 'QC-BUS-0401', 50, 'active')
ON CONFLICT (plate_number) DO UPDATE SET capacity = EXCLUDED.capacity;

-- Insert Active Trip for Bus QC-BUS-0402
INSERT INTO public.trips (id, bus_id, route_id, status, started_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000004',
    'ongoing',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert Initial Bus Location
INSERT INTO public.bus_current_location (bus_id, latitude, longitude, speed, heading, accuracy, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000402',
    14.65022,
    121.05202,
    25.5,
    340.0,
    5.0,
    NOW()
) ON CONFLICT (bus_id) DO UPDATE SET updated_at = NOW();

-- Insert Device Key for GPS hardware test (SHA256 of "qcbus-secret-key-device-0402")
-- Hash: 44b7f8c1f03d52723c34fca7e2c949c25f548f95c5c0a373b5df5b565a50d244
INSERT INTO public.device_keys (id, bus_id, key_hash, device_name)
VALUES (
    '00000000-0000-0000-0000-000000000502',
    '00000000-0000-0000-0000-000000000402',
    '44b7f8c1f03d52723c34fca7e2c949c25f548f95c5c0a373b5df5b565a50d244',
    'QC-BUS-0402 GPS Hardware Unit'
) ON CONFLICT (key_hash) DO NOTHING;
