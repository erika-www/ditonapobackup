/**
 * Supabase Client & Database Integration Service for Passenger App
 * Manages Supabase Auth, Profiles, Journeys, and Realtime subscriptions.
 */
import { createClient } from '@supabase/supabase-js';
import { isPriorityCategory } from '@shared/qrPassUtils';
import { ROUTE4_STOPS } from '@shared/route4Stops';

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

function getPassengerAuthRedirectUrl() {
  const configuredUrl = import.meta.env.VITE_PASSENGER_APP_URL?.trim();
  const redirectUrl = configuredUrl || window.location.origin;

  try {
    const parsedUrl = new URL(redirectUrl);
    if (import.meta.env.PROD && parsedUrl.protocol !== 'https:') {
      throw new Error('VITE_PASSENGER_APP_URL must use HTTPS in production.');
    }
    return parsedUrl.origin;
  } catch (error) {
    console.error('[Auth] Invalid passenger app redirect URL:', error.message);
    return window.location.origin;
  }
}

export async function fetchConfiguredRoute4Stops() {
  // This shared list is the authoritative source for names, order, and GPS.
  // Keeping one source prevents stale database coordinates from changing the
  // stop selected by nearest-stop detection or displayed on the live map.
  return {
    success: true,
    data: ROUTE4_STOPS.map((stop, index) => ({
      ...stop,
      id: `stop-${index + 1}`,
      stopNumber: index + 1,
      sequenceNumber: index + 1,
      lat: Number(stop.lat),
      lng: Number(stop.lng)
    }))
  };
}

// ========================================================
// AUTHENTICATION FUNCTIONS
// ========================================================

/**
 * Sign up a new passenger account.
 * Database trigger automatically creates profile with role 'passenger'.
 */
export async function signUpPassenger(email, password, fullName, phone) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null
        }
      }
    });

    if (error) throw error;
    return { success: true, user: data.user };
  } catch (err) {
    console.warn('SignUp warning:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Log in passenger account.
 */
export async function loginPassenger(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { success: true, user: data.user };
  } catch (err) {
    console.warn('Login warning:', err.message);
    return { success: false, error: err.message };
  }
}

export async function signUpWithEmail(email, password, name, category) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          passenger_category: category || 'Regular',
        }
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data.session) {
      const loginRes = await supabase.auth.signInWithPassword({ email, password });
      if (!loginRes.error && loginRes.data?.user) {
        return { success: true, user: loginRes.data.user, session: loginRes.data.session };
      }
    }

    return { success: true, user: data.user, session: data.session };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function loginWithEmail(email, password) {
  let { data, error } = await supabase.auth.signInWithPassword({ email, password });
  
  if (error && (error.message?.includes('Invalid login credentials') || error.message?.includes('User not found') || error.message?.includes('credentials'))) {
    const signup = await signUpWithEmail(email, password, email.split('@')[0], 'Regular');
    if (signup.success && signup.user) {
      return signup;
    }
  }

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, user: data.user };
}

/**
 * Google OAuth Login
 */
export async function loginWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getPassengerAuthRedirectUrl() }
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    console.warn('Google OAuth warning:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Facebook OAuth Login
 */
export async function loginWithFacebook() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: getPassengerAuthRedirectUrl() }
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (err) {
    console.warn('Facebook OAuth warning:', err.message);
    return { success: false, error: err.message };
  }
}

export async function logoutUser() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ========================================================
// PASSENGER JOURNEY FUNCTIONS
// ========================================================

export async function savePassengerJourney(journeyData) {
  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (userErr || !userId) {
      if (import.meta.env.DEV) {
        return {
          success: true,
          data: { id: null, ...journeyData, status: 'planned', created_at: new Date().toISOString(), localTest: true },
          localTest: true
        };
      }
      return { success: false, error: userErr?.message || 'Sign in before creating a journey.' };
    }

    const payload = {
      passenger_id: userId,
      qr_token: journeyData.qr_token || null,
      passenger_name: journeyData.passenger_name || null,
      passenger_category: journeyData.passenger_category || null,
      passenger_count: Math.max(1, Number(journeyData.passenger_count) || 1),
      companions: Math.max(0, Number(journeyData.companions) || 0),
      registration_source: 'app',
      trip_id: journeyData.trip_id || null,
      origin_name: journeyData.origin_name,
      origin_lat: journeyData.origin_lat || null,
      origin_lng: journeyData.origin_lng || null,
      destination_name: journeyData.destination_name,
      destination_lat: journeyData.destination_lat || null,
      destination_lng: journeyData.destination_lng || null,
      status: 'planned'
    };

    let { data, error } = await supabase
      .from('passenger_journeys')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Insert journey error:', error);
      if (import.meta.env.DEV) {
        return {
          success: true,
          data: {
            id: null,
            ...journeyData,
            status: 'planned',
            created_at: new Date().toISOString(),
            localTest: true
          },
          localTest: true
        };
      }
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
  } catch (err) {
    console.error('[Supabase] Save journey error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function submitJourneyFeedback(journeyId, rating, text) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sign in to submit feedback.');
    const { error } = await supabase.from('passenger_journeys').update({
      feedback_rating: rating, feedback_text: text.trim() || null
    }).eq('id', journeyId).eq('passenger_id', user.id);
    if (error) {
      if (/feedback_(rating|text)|schema cache|could not find/i.test(error.message)) {
        throw new Error('Feedback storage is not installed in the database yet. Apply migration 20261011000001_passenger_feedback_qr.sql, then reload the Supabase API schema cache.');
      }
      throw error;
    }
    return { success: true };
  } catch (err) { return { success: false, error: err.message }; }
}

export async function updateJourneyStatus(journeyId, status) {
  try {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (userErr || !userId) {
      return { success: false, error: 'User must be logged in to update journey.' };
    }

    const { data, error } = await supabase
      .from('passenger_journeys')
      .update({
        status,
        ...(status === 'completed' ? { alighted_at: new Date().toISOString() } : {})
      })
      .eq('id', journeyId)
      .eq('passenger_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[Supabase] Update journey error:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
  } catch (err) {
    console.error('[Supabase] Update journey error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function fetchUserJourneys(passengerId) {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const activeUserId = userData?.user?.id;

    if (userError || !activeUserId) {
      return { success: false, error: userError?.message || 'No authenticated user identity provided.' };
    }
    if (passengerId && passengerId !== activeUserId) {
      return { success: false, error: 'Requested passenger does not match the authenticated user.' };
    }

    // Do not embed trips/buses here: some deployments have trip_id without a
    // declared PostgREST foreign-key relationship, which makes the whole
    // history query fail (including completed journeys).
    const { data, error } = await supabase
      .from('passenger_journeys')
      .select('*')
      .eq('passenger_id', activeUserId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] Fetch journeys error:', error);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (err) {
    console.error('[Supabase] Fetch journeys warning:', err.message);
    return { success: false, error: err.message };
  }
}

// ========================================================
// LIVE TRACKING & REALTIME OCCUPANCY
// ========================================================

export async function fetchCurrentBusLocation(busId) {
  try {
    const { data, error } = await supabase
      .from('bus_current_location')
      .select('*')
      .eq('bus_id', busId)
      .maybeSingle();

    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function fetchTripOccupancy(tripId) {
  try {
    let occupancyData = null;

    // 1. Fetch from trip_occupancy view if available
    try {
      const { data, error } = await supabase
        .from('trip_occupancy')
        .select('*')
        .eq('trip_id', tripId)
        .maybeSingle();
      if (!error && data) occupancyData = data;
    } catch (_) {}

    // 2. Fetch boarded passengers from passenger_journeys to calculate priority vs regular seat counts
    let priorityBoarded = 0;
    let regularBoarded = 0;
    try {
      let query = supabase.from('passenger_journeys')
        .select('passenger_category,passenger_count,status')
        .eq('status', 'boarded');

      if (tripId && tripId !== 'active-trip') {
        query = query.eq('trip_id', tripId);
      }

      const { data: journeys } = await query;
      if (journeys && journeys.length > 0) {
        for (const j of journeys) {
          const count = Math.max(1, Number(j.passenger_count) || 1);
          if (isPriorityCategory(j.passenger_category)) {
            priorityBoarded += count;
          } else {
            regularBoarded += count;
          }
        }
      }
    } catch (_) {}

    const totalBoarded = priorityBoarded + regularBoarded;
    const busCapacity = Number(occupancyData?.bus_capacity) || 50;
    const currentOnboard = occupancyData?.current_onboard != null ? Number(occupancyData.current_onboard) : totalBoarded;
    const availableSeats = Math.max(0, busCapacity - currentOnboard);
    const availablePrioritySeats = Math.max(0, 20 - priorityBoarded);
    const availableRegularSeats = Math.max(0, 30 - regularBoarded);

    return {
      success: true,
      data: {
        ...(occupancyData || {}),
        trip_id: tripId,
        bus_capacity: busCapacity,
        current_onboard: currentOnboard,
        available_seats: availableSeats,
        priority_boarded: priorityBoarded,
        regular_boarded: regularBoarded,
        available_priority_seats: availablePrioritySeats,
        available_regular_seats: availableRegularSeats
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function fetchActiveTripForRoute(routeCode) {
  try {
    const { data: route, error: routeError } = await supabase.from('routes')
      .select('id,code,name').eq('code', routeCode).maybeSingle();
    if (routeError) throw routeError;
    const routeId = route?.id;

    // Match only the active trip for this route so both apps show the same bus.
    let trip = null;
    if (routeId) {
      const { data: routeTrip } = await supabase.from('trips')
        .select('id,bus_id,route_id,status,started_at,driver_personnel_id,conductor_personnel_id,dispatcher_personnel_id')
        .eq('route_id', routeId).eq('status', 'ongoing')
        .order('started_at', { ascending: false }).limit(1).maybeSingle();
      if (routeTrip) trip = routeTrip;
    }

    if (!trip?.bus_id) return { success: true, data: null };
    const busId = trip.bus_id;

    // Fetch bus metadata (plate_number, capacity)
    const { data: bus } = await supabase.from('buses')
      .select('id,plate_number,capacity').eq('id', busId).maybeSingle();

    const personnelIds = [trip.driver_personnel_id, trip.conductor_personnel_id, trip.dispatcher_personnel_id].filter(Boolean);
    let personnel = [];
    if (personnelIds.length) {
      const { data: personnelRows, error: personnelError } = await supabase
        .from('operations_personnel')
        .select('personnel_id,full_name,personnel_type')
        .in('personnel_id', personnelIds);
      if (personnelError) throw personnelError;
      personnel = personnelRows || [];
    }
    const nameFor = (type, id) => personnel.find((person) => person.personnel_id === id || person.personnel_type === type)?.full_name || 'Not assigned';

    const tripId = trip.id;
    const occupancyResult = await fetchTripOccupancy(tripId);

    return {
      success: true,
      data: {
        id: tripId,
        bus_id: busId,
        route_id: routeId || trip?.route_id || 'route-4',
        status: 'ongoing',
        bus: bus || { id: busId, plate_number: 'QC-BUS-0402', capacity: 50 },
        personnel: {
          driverName: nameFor('driver', trip.driver_personnel_id),
          conductorName: nameFor('conductor', trip.conductor_personnel_id),
          dispatcherName: nameFor('dispatcher', trip.dispatcher_personnel_id)
        },
        occupancy: occupancyResult.data
      }
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function subscribeToBusLocation(busId, onUpdate) {
  if (!busId) return () => {};
  const channel = supabase
    .channel(`bus_location_${busId}_${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bus_current_location',
        filter: `bus_id=eq.${busId}`
      },
      (payload) => {
        if (payload.new) {
          onUpdate(payload.new);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToTripOccupancy(tripId, onUpdate) {
  const channelId = `trip_occupancy_${tripId || 'all'}_${Date.now()}`;
  const channel = supabase
    .channel(channelId)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'boarding_events'
      },
      async () => {
        const occ = await fetchTripOccupancy(tripId);
        if (occ.success && occ.data) {
          onUpdate(occ.data);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'passenger_journeys'
      },
      async () => {
        const occ = await fetchTripOccupancy(tripId);
        if (occ.success && occ.data) {
          onUpdate(occ.data);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
