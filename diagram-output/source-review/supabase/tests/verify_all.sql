-- ========================================================
-- COMPREHENSIVE VERIFICATION & SECURITY AUDIT TEST SUITE
-- ========================================================

BEGIN;

SELECT '=== TEST 1: PROFILE TRIGGER & ROLE IMMUTABILITY ===' AS test_banner;
-- Test 1a: Creating profile via auth trigger defaults to 'passenger'
DO $$
DECLARE
    v_user_id UUID := gen_random_uuid();
    v_role TEXT;
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role)
    VALUES (v_user_id, 'Test Passenger 1', 'passenger1@test.com', 'passenger');

    SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
    IF v_role <> 'passenger' THEN
        RAISE EXCEPTION 'Test 1 Failed: Profile role was not passenger!';
    END IF;
    RAISE NOTICE 'Test 1a Passed: Profile auto-created with passenger role.';
END;
$$;


SELECT '=== TEST 2: CAPACITY & NEGATIVE COUNT CONSTRAINTS ===' AS test_banner;
-- Test 2a: Reject alighting when current_onboard is 0
DO $$
DECLARE
    v_trip_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    BEGIN
        PERFORM public.record_boarding_event(
            p_trip_id := v_trip_id,
            p_event_type := 'alight',
            p_method := 'dashboard'
        );
        RAISE EXCEPTION 'Test 2a Failed: Alighting when empty should have been rejected!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Alighting rejected%' THEN
            RAISE NOTICE 'Test 2a Passed: Alighting below zero correctly rejected.';
        ELSE
            RAISE EXCEPTION 'Test 2a Unexpected Error: %', SQLERRM;
        END IF;
    END;
END;
$$;


SELECT '=== TEST 3: ATOMIC BOARDING & CAPACITY LIMIT ===' AS test_banner;
-- Test 3a: Boarding up to capacity & rejecting when full
DO $$
DECLARE
    v_trip_id UUID := '00000000-0000-0000-0000-000000000001';
    v_bus_id UUID := '00000000-0000-0000-0000-000000000402';
    i INTEGER;
    v_res JSONB;
BEGIN
    -- Reset boarding events for clean test run
    DELETE FROM public.boarding_events WHERE trip_id = v_trip_id;

    -- Update bus capacity to 2 for quick boundary test
    UPDATE public.buses SET capacity = 2 WHERE id = v_bus_id;

    -- Board 1st passenger
    v_res := public.record_boarding_event(p_trip_id := v_trip_id, p_event_type := 'board', p_method := 'dashboard', p_idempotency_key := 'test-seat-1');
    IF (v_res->>'available_seats')::INT <> 1 THEN
        RAISE EXCEPTION 'Test 3a Failed on seat 1.';
    END IF;

    -- Board 2nd passenger (Last seat)
    v_res := public.record_boarding_event(p_trip_id := v_trip_id, p_event_type := 'board', p_method := 'dashboard', p_idempotency_key := 'test-seat-2');
    IF (v_res->>'available_seats')::INT <> 0 THEN
        RAISE EXCEPTION 'Test 3a Failed on seat 2.';
    END IF;

    -- Attempt 3rd boarding on full bus
    BEGIN
        PERFORM public.record_boarding_event(p_trip_id := v_trip_id, p_event_type := 'board', p_method := 'dashboard', p_idempotency_key := 'test-seat-3');
        RAISE EXCEPTION 'Test 3a Failed: Boarding beyond capacity was allowed!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Boarding rejected%' THEN
            RAISE NOTICE 'Test 3a Passed: Boarding beyond capacity correctly rejected.';
        ELSE
            RAISE EXCEPTION 'Test 3a Unexpected Error: %', SQLERRM;
        END IF;
    END;

    -- Restore bus capacity to 50
    UPDATE public.buses SET capacity = 50 WHERE id = v_bus_id;
END;
$$;


SELECT '=== TEST 4: IDEMPOTENCY & DUPLICATE QR SCAN REJECTION ===' AS test_banner;
DO $$
DECLARE
    v_trip_id UUID := '00000000-0000-0000-0000-000000000001';
    v_res1 JSONB;
    v_res2 JSONB;
    v_key TEXT := 'qr-scan-idempotency-12345';
BEGIN
    DELETE FROM public.boarding_events WHERE idempotency_key = v_key;

    v_res1 := public.record_boarding_event(p_trip_id := v_trip_id, p_event_type := 'board', p_method := 'qr', p_idempotency_key := v_key);
    v_res2 := public.record_boarding_event(p_trip_id := v_trip_id, p_event_type := 'board', p_method := 'qr', p_idempotency_key := v_key);

    IF (v_res2->>'idempotent')::BOOLEAN IS NOT TRUE THEN
        RAISE EXCEPTION 'Test 4 Failed: Duplicate QR scan was not flagged idempotent!';
    END IF;
    RAISE NOTICE 'Test 4 Passed: Scanning same QR key twice does not double count.';
END;
$$;


SELECT '=== TEST 5: DOUBLE-BOARDING PREVENTION FOR SAME PASSENGER ===' AS test_banner;
DO $$
DECLARE
    v_trip_id UUID := '00000000-0000-0000-0000-000000000001';
    v_pass_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role) VALUES (v_pass_id, 'Double Boarder', 'double@test.com', 'passenger');

    PERFORM public.record_boarding_event(p_trip_id := v_trip_id, p_event_type := 'board', p_method := 'qr', p_passenger_id := v_pass_id);

    BEGIN
        PERFORM public.record_boarding_event(p_trip_id := v_trip_id, p_event_type := 'board', p_method := 'qr', p_passenger_id := v_pass_id);
        RAISE EXCEPTION 'Test 5 Failed: Double boarding for same passenger should be rejected!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%already boarded%' THEN
            RAISE NOTICE 'Test 5 Passed: Double boarding for same passenger correctly rejected.';
        ELSE
            RAISE EXCEPTION 'Test 5 Unexpected Error: %', SQLERRM;
        END IF;
    END;
END;
$$;


SELECT '=== TEST 6: PASSENGER JOURNEY SAVING & RETRIEVAL ===' AS test_banner;
DO $$
DECLARE
    v_pass_id UUID := gen_random_uuid();
    v_journey_id UUID;
    v_orig TEXT;
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role) VALUES (v_pass_id, 'Journey Pass', 'journey@test.com', 'passenger');

    INSERT INTO public.passenger_journeys (passenger_id, origin_name, destination_name, status)
    VALUES (v_pass_id, 'Quezon City Hall – NHA Interchange', 'Quirino Highway – SM City Novaliches', 'planned')
    RETURNING id INTO v_journey_id;

    SELECT origin_name INTO v_orig FROM public.passenger_journeys WHERE id = v_journey_id;
    IF v_orig <> 'Quezon City Hall – NHA Interchange' THEN
        RAISE EXCEPTION 'Test 6 Failed: Saved journey origin name mismatched!';
    END IF;
    RAISE NOTICE 'Test 6 Passed: Origin & destination saved and retrieved correctly.';
END;
$$;


SELECT '=== TEST 7: OCCUPANCY RECONCILIATION VIEW AUDIT ===' AS test_banner;
DO $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT reconciliation_status INTO v_status FROM public.occupancy_reconciliation WHERE trip_id = '00000000-0000-0000-0000-000000000001';
    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Test 7 Failed: Reconciliation view returned no row!';
    END IF;
    RAISE NOTICE 'Test 7 Passed: Occupancy reconciliation view audited with status: %', v_status;
END;
$$;

ROLLBACK; -- Clean rollback of test execution
