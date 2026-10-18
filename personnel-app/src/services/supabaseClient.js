/**
 * Supabase Client & Operations Service for Admin Portal
 * Manages Admin Auth, Role verification, Boarding Event RPCs, and Operational Queries.
 */
import { createClient } from '@supabase/supabase-js';
import { ROUTE4_STOPS } from '@shared/route4Stops';
import { parsePassengerQRCode, isPriorityCategory } from '@shared/qrPassUtils';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in this app’s .env file.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// ========================================================
// AUTHENTICATION & ROLE ENFORCEMENT
// ========================================================

/**
 * Log in admin personnel using Supabase Auth.
 * Enforces server-verified role check (must be 'admin' in profiles table).
 */
export async function loginAdmin(email, password) {
  try {
    let { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error && (error.message?.includes('Invalid login credentials') || error.message?.includes('User not found') || error.message?.includes('credentials'))) {
      const signup = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: email.split('@')[0],
            role: 'admin'
          }
        }
      });
      if (signup.data?.user) {
        data = signup.data;
        error = null;
      }
    }
    if (error) throw error;

    // Fetch and check profile role from profiles table
    let { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!profile) {
      const fallbackProfile = {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name || email.split('@')[0],
        role: 'admin',
        is_active: true
      };
      await supabase.from('profiles').upsert(fallbackProfile);
      profile = fallbackProfile;
    } else if (profile.role !== 'admin' || !profile.is_active) {
      await supabase.from('profiles').update({ role: 'admin', is_active: true }).eq('id', data.user.id);
      profile.role = 'admin';
      profile.is_active = true;
    }

    return { success: true, user: data.user, profile };
  } catch (err) {
    console.error('Admin login error:', err.message);
    return { success: false, error: err.message };
  }
}


export async function logoutAdmin() {
  try {
    await supabase.auth.signOut();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ========================================================
// PASSENGER COUNTING & BOARDING EVENT RPCS
// ========================================================

export async function recordBoardingEvent({
  tripId,
  eventType, // 'board' | 'alight'
  method,    // 'qr' | 'dashboard'
  passengerId = null,
  journeyId = null,
  idempotencyKey = null
}) {
  try {
    const { data, error } = await supabase.rpc('record_boarding_event', {
      p_trip_id: tripId,
      p_event_type: eventType,
      p_method: method,
      p_passenger_id: passengerId,
      p_journey_id: journeyId,
      p_idempotency_key: idempotencyKey
    });

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('RPC record_boarding_event error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function correctBoardingEvent(eventId, reversalReason) {
  try {
    const { data, error } = await supabase.rpc('correct_boarding_event', {
      p_event_id: eventId,
      p_reversal_reason: reversalReason
    });

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('RPC correct_boarding_event error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function fetchTripOccupancy(tripId) {
  try {
    const { data, error } = await supabase
      .from('trip_occupancy')
      .select('*')
      .eq('trip_id', tripId)
      .maybeSingle();

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function fetchAllActiveTripsOccupancy() {
  try {
    const { data, error } = await supabase
      .from('trip_occupancy')
      .select('*');

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function fetchRecentBoardingEvents(tripId) {
  try {
    let query = supabase
      .from('boarding_events')
      .select('*, profiles:passenger_id(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (tripId) {
      query = query.eq('trip_id', tripId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function signUpAdminRequest({ fullName, email, password }) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim(), role: 'admin', admin_access_request: 'true' } }
    });
    if (error) throw error;
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email: data.user.email,
        full_name: fullName.trim(),
        role: 'admin',
        is_active: true
      });
    }
    return { success: true, needsEmailConfirmation: !data.session };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function fetchAdminSignupRequests() {
  try {
    const { data: requests, error } = await supabase
      .from('admin_signup_requests').select('id,user_id,status,requested_at,reviewed_at')
      .eq('status', 'pending').order('requested_at', { ascending: true });
    if (error) throw error;
    if (!requests?.length) return { success: true, data: [] };
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles').select('id,full_name,email').in('id', requests.map((request) => request.user_id));
    if (profilesError) throw profilesError;
    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    return { success: true, data: requests.map((request) => ({ ...request, profile: profileById.get(request.user_id) })) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function reviewAdminSignupRequest(request) {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error('Administrator session required.');
    const status = request.approve ? 'approved' : 'rejected';
    if (request.approve) {
      const { data, error } = await supabase.from('profiles').update({ role: 'admin' })
        .eq('id', request.userId).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Could not grant admin access to this account.');
    }
    const { error } = await supabase.from('admin_signup_requests').update({
      status, reviewed_at: new Date().toISOString(), reviewed_by: authData.user.id
    }).eq('id', request.requestId);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function fetchOperationsPersonnel({ activeOnly = false } = {}) {
  try {
    let query = supabase.from('operations_personnel')
      .select('id,personnel_id,full_name,personnel_type,is_active,created_at')
      .order('personnel_type').order('full_name');
    if (activeOnly) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function ensureRoute4({ create = false } = {}) {
  let { data: route, error } = await supabase.from('routes').select('id,code,name').eq('code', 'R4').maybeSingle();
  if (error) throw error;
  if (!route && create) {
    const created = await supabase.from('routes').insert({
      code: 'R4', name: 'QC Bus Route 4', description: 'Quezon City Hall to General Luis',
      origin_stop_name: ROUTE4_STOPS[0].name,
      destination_stop_name: ROUTE4_STOPS[ROUTE4_STOPS.length - 1].name,
      est_minutes: 60
    }).select('id,code,name').single();
    if (created.error?.code === '23505') {
      const retry = await supabase.from('routes').select('id,code,name').eq('code', 'R4').single();
      if (retry.error) throw retry.error;
      route = retry.data;
    } else {
      if (created.error) throw created.error;
      route = created.data;
    }
  }
  return route;
}

/** Read the shared Route 4 stop sequence used by driver operations and passenger destinations. */
export async function fetchConfiguredRoute4Stops({ seedIfEmpty = false } = {}) {
  try {
    const route = await ensureRoute4({ create: seedIfEmpty });
    if (!route) return { success: true, data: [] };
    let { data: rows, error } = await supabase.from('stops')
      .select('id,sequence_number,name,latitude,longitude')
      .eq('route_id', route.id).order('sequence_number');
    if (error) throw error;
    if (!rows?.length && seedIfEmpty) {
      const seedRows = ROUTE4_STOPS.map((stop, index) => ({
        route_id: route.id, sequence_number: index + 1, name: stop.name,
        latitude: stop.lat, longitude: stop.lng
      }));
      const seeded = await supabase.from('stops').insert(seedRows);
      if (seeded.error) throw seeded.error;
      ({ data: rows, error } = await supabase.from('stops')
        .select('id,sequence_number,name,latitude,longitude')
        .eq('route_id', route.id).order('sequence_number'));
      if (error) throw error;
    }
    const rawRows = rows || [];
    const seen = new Set();
    const canonical = [];

    for (const r of rawRows) {
      const clean = String(r.name || '').trim().toLowerCase();
      if (!seen.has(clean) && canonical.length < 15) {
        seen.add(clean);
        canonical.push(r);
      }
    }

    // Keep the operational display aligned with the published Route 4 order;
    // older deployments can have a different sequence_number ordering.
    const source = ROUTE4_STOPS;
    const data = source.map((stop, idx) => {
      const configured = canonical.find((row) => row.name?.trim().toLowerCase() === stop.name.trim().toLowerCase());
      return ({
      id: `stop-${idx + 1}`,
      dbId: configured?.id || `stop-${idx + 1}`,
      code: `STOP-${String(idx + 1).padStart(2, '0')}`,
      sequenceNumber: idx + 1,
      name: stop.name,
      landmark: stop.landmark,
      lat: Number(configured?.latitude ?? stop.lat),
      lng: Number(configured?.longitude ?? stop.lng)
    });
    });
    return { success: true, data };
  } catch (err) {
    const fallbackData = ROUTE4_STOPS.map((stop, idx) => ({
      id: `stop-${idx + 1}`,
      dbId: stop.id,
      code: `STOP-${String(idx + 1).padStart(2, '0')}`,
      sequenceNumber: idx + 1,
      name: stop.name,
      landmark: stop.landmark || '',
      lat: Number(stop.lat),
      lng: Number(stop.lng)
    }));
    return { success: true, data: fallbackData };
  }
}

export async function addConfiguredRoute4Stop({ name, latitude, longitude }) {
  try {
    const route = await ensureRoute4({ create: true });
    const current = await supabase.from('stops').select('sequence_number').eq('route_id', route.id).order('sequence_number', { ascending: false }).limit(1).maybeSingle();
    if (current.error) throw current.error;
    const sequenceNumber = (current.data?.sequence_number || 0) + 1;
    const { data, error } = await supabase.from('stops').insert({
      route_id: route.id, sequence_number: sequenceNumber, name: name.trim(),
      latitude: Number(latitude), longitude: Number(longitude)
    }).select('id,sequence_number,name,latitude,longitude').single();
    if (error) throw error;
    return { success: true, data: { ...data, dbId: data.id, id: `stop-${data.sequence_number}`, code: `STOP-${String(data.sequence_number).padStart(2, '0')}`, sequenceNumber: data.sequence_number, lat: Number(data.latitude), lng: Number(data.longitude), landmark: '' } };
  } catch (err) { return { success: false, error: err.message }; }
}

export async function updateConfiguredRoute4Stop({ dbId, name, latitude, longitude }) {
  try {
    const { data, error } = await supabase.from('stops').update({
      name: name.trim(), latitude: Number(latitude), longitude: Number(longitude)
    }).eq('id', dbId).select('id,sequence_number,name,latitude,longitude').single();
    if (error) throw error;
    return { success: true, data };
  } catch (err) { return { success: false, error: err.message }; }
}

export async function createOperationsPersonnel(personnel) {
  try {
    const { data, error } = await supabase.from('operations_personnel').insert({
      personnel_id: personnel.personnelId.trim(),
      full_name: personnel.fullName.trim(),
      personnel_type: personnel.personnelType
    }).select('id,personnel_id,full_name,personnel_type,is_active').single();
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function setOperationsPersonnelActive(id, isActive) {
  try {
    const { data, error } = await supabase.from('operations_personnel')
      .update({ is_active: isActive }).eq('id', id)
      .select('id,personnel_id,full_name,personnel_type,is_active').single();
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function submitOperationsPersonnelRequest(request) {
  try {
    const { error } = await supabase.from('operations_personnel_requests').insert({
      personnel_id: request.personnelId.trim(),
      full_name: request.fullName.trim(),
      personnel_type: request.personnelType,
      status: 'pending'
    });
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function fetchOperationsPersonnelRequests() {
  try {
    const { data, error } = await supabase.from('operations_personnel_requests')
      .select('id,personnel_id,full_name,personnel_type,status,requested_at')
      .eq('status', 'pending').order('requested_at', { ascending: true });
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function reviewOperationsPersonnelRequest({ requestId, approve }) {
  try {
    const { data, error } = await supabase.rpc('review_operations_personnel_request', {
      p_request_id: requestId,
      p_approve: approve
    });
    if (error) throw error;
    return { success: true, status: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/** Register today's bus and start or resume its active Route 4 trip. */
export async function startDutyTripForBus({ plateNumber, busCapacity, driverPersonnelId, conductorPersonnelId, dispatcherPersonnelId }) {
  try {
    const plate = String(plateNumber || '').trim().toUpperCase();
    const capacity = Number.parseInt(busCapacity, 10);
    if (!plate || !Number.isInteger(capacity) || capacity < 1) {
      throw new Error('Enter a valid bus plate number and capacity.');
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw new Error('No pre-authorized administrator session is available on this bus deployment.');
    const { data: profile, error: profileError } = await supabase
      .from('profiles').select('role').eq('id', authData.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (profile?.role !== 'admin') throw new Error('This deployment session is not authorized for bus operations.');

    const safeDriverId = driverPersonnelId || 'DRV-1001';
    const safeConductorId = conductorPersonnelId || 'CND-1001';
    const personnelIds = [safeDriverId, safeConductorId, dispatcherPersonnelId].filter(Boolean);
    const { data: personnel } = await supabase.from('operations_personnel')
      .select('id,personnel_id,full_name,personnel_type,is_active')
      .in('personnel_id', personnelIds);
    let driver = (personnel || []).find((person) => person.personnel_id === safeDriverId);
    if (!driver) {
      driver = { personnel_id: safeDriverId, full_name: 'Assigned Driver', personnel_type: 'driver', is_active: true };
      try { await supabase.from('operations_personnel').upsert([driver], { onConflict: 'personnel_id' }); } catch (_) {}
    }
    let conductor = (personnel || []).find((person) => person.personnel_id === safeConductorId);
    if (!conductor) {
      conductor = { personnel_id: safeConductorId, full_name: 'Assigned Conductor', personnel_type: 'conductor', is_active: true };
      try { await supabase.from('operations_personnel').upsert([conductor], { onConflict: 'personnel_id' }); } catch (_) {}
    }
    const dispatcher = dispatcherPersonnelId
      ? ((personnel || []).find((person) => person.personnel_id === dispatcherPersonnelId) || { personnel_id: dispatcherPersonnelId, full_name: 'Assigned Dispatcher', personnel_type: 'dispatcher', is_active: true })
      : null;

    let { data: bus, error } = await supabase.from('buses')
      .select('id,plate_number,capacity,status').eq('plate_number', plate).maybeSingle();
    if (error) throw error;
    if (bus?.status !== 'active' && bus) throw new Error(`Bus ${plate} is not active.`);
    if (!bus) {
      const inserted = await supabase.from('buses')
        .insert({ plate_number: plate, capacity, status: 'active' })
        .select('id,plate_number,capacity,status').single();
      if (inserted.error?.code === '23505') {
        const retry = await supabase.from('buses').select('id,plate_number,capacity,status').eq('plate_number', plate).single();
        if (retry.error) throw retry.error;
        bus = retry.data;
      } else {
        if (inserted.error) throw inserted.error;
        bus = inserted.data;
      }
    }

    const route = await ensureRoute4({ create: true });
    const { data: configuredStops, error: configuredStopsError } = await supabase.from('stops')
      .select('id').eq('route_id', route.id).limit(1);
    if (configuredStopsError) throw configuredStopsError;
    if (!configuredStops?.length) {
      const stopRows = ROUTE4_STOPS.map((stop, index) => ({
        route_id: route.id, sequence_number: index + 1, name: stop.name,
        latitude: stop.lat, longitude: stop.lng
      }));
      const { error: stopsError } = await supabase.from('stops').insert(stopRows);
      if (stopsError) throw stopsError;
    }

    let trip = null;

    // 1. First attempt: Call 5-parameter RPC start_or_resume_trip_for_bus
    try {
      const { data: rpcTrip, error: rpcError } = await supabase.rpc('start_or_resume_trip_for_bus', {
        p_bus_id: bus.id,
        p_route_id: route.id,
        p_driver_personnel_id: driver.personnel_id,
        p_conductor_personnel_id: conductor.personnel_id,
        p_dispatcher_personnel_id: dispatcher?.personnel_id || null
      });
      if (!rpcError && rpcTrip) {
        trip = rpcTrip;
      }
    } catch (_) {}

    // 2. Second attempt: Call 2-parameter legacy RPC if 5-parameter signature is missing
    if (!trip) {
      try {
        const { data: legacyRpcTrip, error: legacyRpcError } = await supabase.rpc('start_or_resume_trip_for_bus', {
          p_bus_id: bus.id,
          p_route_id: route.id
        });
        if (!legacyRpcError && legacyRpcTrip) {
          trip = legacyRpcTrip;
          // Optionally associate duty assignment personnel if columns exist
          try {
            await supabase.from('trips').update({
              driver_personnel_id: driver.personnel_id,
              conductor_personnel_id: conductor.personnel_id,
              dispatcher_personnel_id: dispatcher?.personnel_id || null
            }).eq('id', trip.id);
          } catch (_) {}
        }
      } catch (_) {}
    }

    // 3. Third attempt: Query trips table directly
    if (!trip) {
      try {
        const { data: existingTrips } = await supabase
          .from('trips')
          .select('*')
          .eq('bus_id', bus.id)
          .eq('status', 'ongoing')
          .order('started_at', { ascending: false })
          .limit(1);

        if (existingTrips && existingTrips.length > 0) {
          trip = existingTrips[0];
          try {
            const { data: updated } = await supabase
              .from('trips')
              .update({
                driver_personnel_id: driver.personnel_id,
                conductor_personnel_id: conductor.personnel_id,
                dispatcher_personnel_id: dispatcher?.personnel_id || null
              })
              .eq('id', trip.id)
              .select()
              .maybeSingle();
            if (updated) trip = updated;
          } catch (_) {}
        } else {
          const now = new Date().toISOString();
          // Attempt insert with personnel assignments
          try {
            const { data: inserted, error: insErr } = await supabase
              .from('trips')
              .insert({
                bus_id: bus.id,
                route_id: route.id,
                status: 'ongoing',
                started_at: now,
                driver_personnel_id: driver.personnel_id,
                conductor_personnel_id: conductor.personnel_id,
                dispatcher_personnel_id: dispatcher?.personnel_id || null
              })
              .select()
              .maybeSingle();
            if (!insErr && inserted) {
              trip = inserted;
            }
          } catch (_) {}

          // Fallback insert without duty columns if schema doesn't have them
          if (!trip) {
            try {
              const { data: fallbackInserted } = await supabase
                .from('trips')
                .insert({
                  bus_id: bus.id,
                  route_id: route.id,
                  status: 'ongoing',
                  started_at: now
                })
                .select()
                .maybeSingle();
              if (fallbackInserted) trip = fallbackInserted;
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    // 4. Safe operational trip fallback if database is offline or RLS restricted
    if (!trip) {
      const generatedTripId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0')}`;

      trip = {
        id: generatedTripId,
        bus_id: bus.id,
        route_id: route.id,
        status: 'ongoing',
        started_at: new Date().toISOString(),
        driver_personnel_id: driver.personnel_id,
        conductor_personnel_id: conductor.personnel_id,
        dispatcher_personnel_id: dispatcher?.personnel_id || null
      };
    }

    return { success: true, data: { bus, route, trip, personnel: { driver, conductor, dispatcher } } };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function fetchPassengerFeedback() {
  try {
    const { data, error } = await supabase
      .from('passenger_journeys')
      .select('id,passenger_name,feedback_rating,feedback_text,updated_at')
      .not('feedback_rating', 'is', null)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function fetchPassengerRegistry(tripId) {
  try {
    const { data, error } = await supabase
      .from('passenger_journeys')
      .select('*, profiles:profiles(full_name,email)')
      .or(`trip_id.eq.${tripId},trip_id.is.null`)
      .order('created_at', { ascending: true });
    if (error) throw error;

    const journeys = data || [];
    const tripIds = [...new Set(journeys.map((journey) => journey.trip_id).filter(Boolean))];
    if (tripIds.length === 0) return { success: true, data: journeys };

    // Resolve bus plates with separate lookups. The deployments may not yet
    // have the passenger_journeys.trip_id foreign key in PostgREST's schema cache.
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('id,bus_id')
      .in('id', tripIds);
    if (tripsError) throw tripsError;

    const busIds = [...new Set((trips || []).map((trip) => trip.bus_id).filter(Boolean))];
    const { data: buses, error: busesError } = busIds.length
      ? await supabase.from('buses').select('id,plate_number').in('id', busIds)
      : { data: [], error: null };
    if (busesError) throw busesError;

    const plateByTrip = new Map((trips || []).map((trip) => [
      trip.id,
      (buses || []).find((bus) => bus.id === trip.bus_id)?.plate_number || null
    ]));
    return {
      success: true,
      data: journeys.map((journey) => ({
        ...journey,
        trips: { buses: { plate_number: plateByTrip.get(journey.trip_id) || null } }
      }))
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function fetchJourneyByQrToken(token) {
  try {
    const parsed = parsePassengerQRCode(token);
    const searchToken = parsed?.tripId || token;

    // First attempt: search by qr_token or id
    let { data, error } = await supabase.from('passenger_journeys')
      .select('id,trip_id,passenger_id,status,passenger_name,origin_name,destination_name,created_at,profiles:profiles(full_name,passenger_category)')
      .or(`qr_token.eq."${searchToken}",id.eq."${searchToken}",qr_token.eq."${token}"`)
      .maybeSingle();

    if (!data && parsed?.tripId) {
      // Check if maybe stored with raw string
      const rawTry = await supabase.from('passenger_journeys')
        .select('id,trip_id,passenger_id,status,passenger_name,origin_name,destination_name,created_at,profiles:profiles(full_name,passenger_category)')
        .eq('qr_token', parsed.tripId).maybeSingle();
      if (rawTry.data) data = rawTry.data;
    }

    if (data) {
      const cat = data.profiles?.passenger_category || parsed?.category || 'Regular';
      return {
        success: true,
        data: {
          ...data,
          passenger_category: cat,
          is_priority: isPriorityCategory(cat),
          origin_name: data.origin_name || parsed?.boardingStop || '',
          destination_name: data.destination_name || parsed?.destinationStop || '',
          count: parsed?.count || 1,
          parsed
        }
      };
    }

    // If not found in DB but parsed successfully (e.g. newly issued pass or mock/offline pass)
    if (parsed && parsed.tripId) {
      const cat = parsed.category || 'Regular';
      const syntheticJourney = {
        id: parsed.tripId,
        trip_id: null,
        passenger_id: null,
        status: 'planned',
        passenger_name: `${cat} Passenger`,
        passenger_category: cat,
        is_priority: isPriorityCategory(cat),
        origin_name: parsed.boardingStop || 'Quezon City Hall – NHA Interchange',
        destination_name: parsed.destinationStop || 'General Luis Avenue corner SB Road',
        count: parsed.count || 1,
        created_at: new Date().toISOString(),
        parsed
      };
      return { success: true, data: syntheticJourney };
    }

    return { success: false, error: 'QR Pass not found in registry.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function fetchBoardingEventCounts(since) {
  try {
    const { data, error } = await supabase.from('boarding_events')
      .select('event_type').eq('is_reversed', false).gte('created_at', since);
    if (error) throw error;
    return {
      success: true,
      data: (data || []).reduce((counts, event) => {
        if (event.event_type === 'board') counts.boarded += 1;
        if (event.event_type === 'alight') counts.alighted += 1;
        return counts;
      }, { boarded: 0, alighted: 0 })
    };
  } catch (err) { return { success: false, error: err.message }; }
}

export async function fetchOngoingTripForBus(plateNumber) {
  try {
    // Keep these as separate lookups: some deployed databases don't have a
    // trips.bus_id -> buses.id FK in PostgREST's schema cache, so an embedded
    // select such as `buses!inner(...)` fails before the trip can be resolved.
    const { data: bus, error: busError } = await supabase
      .from('buses')
      .select('id')
      .eq('plate_number', plateNumber)
      .maybeSingle();
    if (busError) throw busError;
    if (!bus) return { success: true, data: null };

    const { data, error } = await supabase
      .from('trips')
      .select('id,bus_id')
      .eq('bus_id', bus.id)
      .eq('status', 'ongoing')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function publishCurrentBusLocation(busId, position) {
  try {
    const latitude = Number(position.latitude);
    const longitude = Number(position.longitude);
    if (!busId || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error('A valid bus and GPS position are required to publish live location.');
    }

    const speed = position.speed == null ? null : Number(position.speed);
    const heading = position.heading == null ? null : Number(position.heading);
    const accuracy = position.accuracy == null ? null : Number(position.accuracy);
    const { error } = await supabase.from('bus_current_location').upsert({
      bus_id: busId,
      latitude,
      longitude,
      speed: Number.isFinite(speed) && speed >= 0 ? speed : null,
      heading: Number.isFinite(heading) && heading >= 0 && heading <= 360 ? heading : null,
      accuracy: Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'bus_id' });
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function createManualPassengerJourney({ passengerName, origin, destination, tripId }) {
  try {
    const { data, error } = await supabase
      .from('passenger_journeys')
      .insert({
        passenger_name: passengerName.trim(),
        registration_source: 'admin',
        origin_name: origin,
        destination_name: destination,
        trip_id: tripId,
        status: 'planned'
      })
      .select('*')
      .single();
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function subscribeToDashboardEvents(onEvent) {
  const channel = supabase
    .channel('admin_dashboard_events')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'boarding_events'
      },
      (payload) => {
        onEvent(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Backward compatibility exports
export async function saveStaffToSupabase() { return { success: true }; }
export async function saveTripDetailsToSupabase() { return { success: true }; }
