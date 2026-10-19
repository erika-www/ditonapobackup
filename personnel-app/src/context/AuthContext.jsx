/**
 * AuthContext Component (React / JSX)
 * Manages duty session details, personnel profile, and access authorization for QC Bus Admin.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchPassengerRegistry, loginAdmin, logoutAdmin, startDutyTripForBus, startNextTrip, supabase } from '../services/supabaseClient';

const AuthContext = createContext({});

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const ENABLE_TEST_MODE = import.meta.env.DEV && import.meta.env.VITE_ENABLE_TEST_MODE === 'true';
const serviceDateToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const DEV_TEST_TRIP_ID = '00000000-0000-4000-8000-000000000004';
const createDevTestDutySession = () => ({
  ...DEFAULT_DUTY,
  driverName: 'GPS Test Driver',
  driverId: 'DRV-TEST',
  driverPersonnelId: 'DRV-TEST',
  conductorName: 'GPS Test Conductor',
  conductorPersonnelId: 'CND-TEST',
  plateNumber: 'QC-BUS-0402',
  busCapacity: 50,
  tripDirection: 'Northbound',
  tripId: DEV_TEST_TRIP_ID,
  serviceDate: serviceDateToday(),
  testMode: true
});

function readDutySession() {
  try {
    const saved = localStorage.getItem('qcbus_duty_session');
    if (!saved) return ENABLE_TEST_MODE ? createDevTestDutySession() : DEFAULT_DUTY;
    const session = JSON.parse(saved);
    if (!ENABLE_TEST_MODE && (session.testMode || session.tripId === DEV_TEST_TRIP_ID)) return DEFAULT_DUTY;
    return {
      ...DEFAULT_DUTY,
      ...session,
      testMode: Boolean(session.testMode),
      // Older sessions stored a non-UUID placeholder here. Let the passenger
      // summary resolve the real active trip from the assigned bus instead.
      tripId: UUID_PATTERN.test(session?.tripId || '') ? session.tripId : (ENABLE_TEST_MODE ? DEV_TEST_TRIP_ID : null),
      serviceDate: ENABLE_TEST_MODE ? serviceDateToday() : session.serviceDate,
      plateNumber: session.plateNumber || (ENABLE_TEST_MODE ? 'QC-BUS-0402' : '')
    };
  } catch {
    return DEFAULT_DUTY;
  }
}

const DEFAULT_DUTY = {
  driverName: 'Juan Dela Cruz',
  driverId: 'DRV-1024',
  conductorName: '',
  dispatcherName: '',
  plateNumber: '',
  driverPersonnelId: '',
  conductorPersonnelId: '',
  dispatcherPersonnelId: '',
  busCapacity: null,
  tripDirection: 'Northbound',
  tripId: null,
  serviceDate: null,
  loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
};

export function AuthProvider({ children }) {
  const [dutySession, setDutySession] = useState(readDutySession);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState(null);

  // Prompt location permission
  const requestLocationPermission = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationPermission(true);
        },
        (err) => {
          console.warn('Location permission error or denied:', err);
          setLocationPermission(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setLocationPermission(true);
    }
  };

  useEffect(() => {
    requestLocationPermission();
  }, []);

  useEffect(() => {
    let active = true;
    const restoreAdminSession = async (session) => {
      if (!session?.user) {
        if (active) { setToken(null); setUser(null); }
        return;
      }
      let { data: profile } = await supabase
        .from('profiles').select('role,full_name,is_active').eq('id', session.user.id).maybeSingle();
      if (!active) return;
      if (!profile || profile.role !== 'admin' || !profile.is_active) {
        setToken(null);
        setUser(null);
        return;
      }
      setToken(session.access_token);
      setUser({ id: session.user.id, username: profile.full_name || session.user.email, role: 'admin' });
    };
    supabase.auth.getSession().then(({ data }) => restoreAdminSession(data.session))
      .catch(() => { if (active) { setToken(null); setUser(null); } })
      .finally(() => { if (active) setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer profile reads until after the auth callback releases its lock.
      setTimeout(() => restoreAdminSession(session), 0);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const login = async (sessionDetails = {}) => {
    if (ENABLE_TEST_MODE) {
      const testDuty = {
        ...createDevTestDutySession(),
        driverId: sessionDetails.driverPersonnelId || 'DRV-TEST',
        driverPersonnelId: sessionDetails.driverPersonnelId || 'DRV-TEST',
        conductorPersonnelId: sessionDetails.conductorPersonnelId || 'CND-TEST',
        plateNumber: sessionDetails.plateNumber || 'QC-BUS-0402',
        busCapacity: Number(sessionDetails.busCapacity) || 50,
        tripDirection: sessionDetails.tripDirection || 'Northbound'
      };
      localStorage.setItem('qcbus_duty_session', JSON.stringify(testDuty));
      setDutySession(testDuty);
      requestLocationPermission();
      return { success: true, testMode: true };
    }

    const { data: authData } = await supabase.auth.getSession();
    if (!authData?.session?.user && !token && user?.role !== 'admin') {
      throw new Error('No pre-authorized administrator session is available on this bus deployment.');
    }
    const tripResult = await startDutyTripForBus(sessionDetails);
    if (!tripResult.success) throw new Error(tripResult.error);
    let dutyTrip = tripResult.data.trip;
    const existingRegistry = await fetchPassengerRegistry(dutyTrip.id);
    if (existingRegistry.success && existingRegistry.data.length > 0) {
      const freshTrip = await startNextTrip({
        currentTripId: dutyTrip.id,
        direction: sessionDetails.tripDirection || 'Northbound'
      });
      if (!freshTrip.success) throw new Error(freshTrip.error || 'Unable to start a fresh duty trip.');
      dutyTrip = freshTrip.data;
    }
    const newDutySession = {
      driverName: tripResult.data.personnel.driver.full_name,
      driverId: tripResult.data.personnel.driver.personnel_id,
      driverPersonnelId: tripResult.data.personnel.driver.personnel_id,
      conductorName: tripResult.data.personnel.conductor.full_name,
      conductorPersonnelId: tripResult.data.personnel.conductor.personnel_id,
      dispatcherName: tripResult.data.personnel.dispatcher?.full_name || '',
      dispatcherPersonnelId: tripResult.data.personnel.dispatcher?.personnel_id || '',
      plateNumber: tripResult.data.bus.plate_number,
      busCapacity: tripResult.data.bus.capacity,
      tripDirection: sessionDetails.tripDirection || 'Northbound',
      tripId: dutyTrip.id,
      serviceDate: serviceDateToday(),
      loginTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    localStorage.setItem('qcbus_duty_session', JSON.stringify(newDutySession));
    setDutySession(newDutySession);
    requestLocationPermission();
    return { success: true, trip: dutyTrip };
  };

  const loginAdminAccount = async (email, password) => {
    const result = await loginAdmin(email, password);
    if (!result.success) throw new Error(result.error || 'Unable to sign in as an administrator.');
    const { data } = await supabase.auth.getSession();
    setToken(data?.session?.access_token || 'admin-session-token');
    setUser({ id: result.user.id, username: result.profile.full_name || result.user.email, role: 'admin' });
    return result;
  };

  const updateDutySession = (updated) => {
    const next = { ...dutySession, ...updated };
    localStorage.setItem('qcbus_duty_session', JSON.stringify(next));
    setDutySession(next);
  };

  const logout = async () => {
    await logoutAdmin();
    localStorage.removeItem('qcbus_duty_session');
    setToken(null);
    setUser(null);
    setDutySession(DEFAULT_DUTY);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        dutySession: dutySession || DEFAULT_DUTY,
        updateDutySession,
        isAuthenticated: !!token && user?.role === 'admin',
        isTestMode: ENABLE_TEST_MODE && Boolean(dutySession.testMode),
        isDutyRegistered: dutySession.serviceDate === serviceDateToday()
          && Boolean(dutySession.plateNumber && dutySession.tripId),
        loading,
        locationPermission,
        requestLocationPermission,
        login,
        loginAdminAccount,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
