/**
 * AuthContext.jsx
 * Centralized Supabase Auth & Profile Session Manager
 * Single source of truth for authentication state across the application.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [profileRetry, setProfileRetry] = useState(0);

  // Check for any OAuth redirect errors from Google or provider
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const desc = params.get('error_description') || hash.get('error_description');
    if (desc) {
      console.error('[Auth] OAuth redirect error:', desc);
      setAuthError(desc.replace(/\+/g, ' '));
    }
  }, []);

  // 1. Auth session initialization & lightweight listener setup
  useEffect(() => {
    let mounted = true;

    // Restore pre-existing session on application start / refresh
    async function initAuthSession() {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('[AuthContext] getSession error:', error.message);
        }

        if (currentSession?.user) {
          if (mounted) {
            setSession(currentSession);
            setUser(currentSession.user);
            setLoading(false);
          }
          return;
        }

        // Testing flow: create a persistent, no-credentials Supabase identity.
        // If anonymous sign-in is disabled for this project, use a local test
        // identity so the passenger UI and saved QR journey remain testable.
        const { data, error: anonymousError } = await supabase.auth.signInAnonymously();
        if (anonymousError) throw anonymousError;
        if (mounted) {
          setSession(data.session ?? null);
          setUser(data.user ?? data.session?.user ?? null);
          setLoading(false);
        }
      } catch (err) {
        console.error('[AuthContext] initAuthSession error:', err);
        if (mounted) {
          const localId = localStorage.getItem('qcbus_anonymous_test_id') || `local-${crypto.randomUUID()}`;
          localStorage.setItem('qcbus_anonymous_test_id', localId);
          setUser({ id: localId, is_anonymous: true, user_metadata: { full_name: 'Anonymous Passenger' } });
          setLoading(false);
        }
      }
    }

    initAuthSession();

    // Subscribe to Supabase Auth state changes (keep callback lightweight!)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      console.log(`[AuthContext] AUTH EVENT: ${event} | USER ID: ${currentSession?.user?.id || 'NONE'}`);

      if (mounted) {
        setSession(currentSession ?? null);
        setUser(currentSession?.user ?? null);
        if (!currentSession?.user) {
          setProfile(null);
        }
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Separate Profile Synchronization Process (Runs asynchronously when user identity is established)
  useEffect(() => {
    let active = true;

    async function loadOrSyncProfile() {
      if (!user) {
        setProfile(null);
        setProfileError(null);
        return;
      }

      try {
        setProfileError(null);
        // Fetch existing profile from public.profiles table
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw new Error(`Could not read your passenger profile: ${error.message}`);

        if (data && active) {
          setProfile(data);
          return;
        }

        // If profile not found in DB (e.g. database trigger race condition), attempt idempotent upsert
        const meta = user.user_metadata || {};
        const newProfile = {
          id: user.id,
          email: user.email || null,
          full_name: meta.full_name || meta.name || user.email?.split('@')[0] || 'QC Commuter',
          passenger_category: meta.passenger_category || 'Regular',
          avatar_url: meta.avatar_url || null,
          role: 'passenger',
          is_active: true
        };

        // Anonymous test identities should never need profile privilege writes.
        // Keep a UI-only profile when the auth trigger has not created one.
        if (user.is_anonymous) {
          if (active) setProfile(newProfile);
          return;
        }

        const { data: created, error: createErr } = await supabase
          .from('profiles').upsert([newProfile], { onConflict: 'id' }).select().maybeSingle();

        if (createErr) {
          console.warn('[Profile Sync] Remote profile upsert skipped, using active local profile:', createErr.message);
          if (active) {
            setProfile(newProfile);
            setProfileError(null);
          }
          return;
        }

        if (active && created) {
          setProfile(created);
          setProfileError(null);
        }
      } catch (err) {
        console.warn('[Profile Sync] Handled profile sync:', err);
        // Fallback to active commuter profile so user is never locked out
        const meta = user.user_metadata || {};
        if (active) {
          setProfile({
            id: user.id,
            email: user.email,
            full_name: meta.full_name || meta.name || user.email?.split('@')[0] || 'QC Commuter',
            passenger_category: meta.passenger_category || 'Regular',
            role: 'passenger',
            is_active: true
          });
          setProfileError(null);
        }
      }
    }

    loadOrSyncProfile();

    return () => {
      active = false;
    };
  }, [user?.id, profileRetry]);

  const retryProfile = () => setProfileRetry((attempt) => attempt + 1);

  // Update passenger category in public.profiles table and local state immediately
  const updateCategory = async (newCategory) => {
    if (!user) return { success: false, error: 'User not authenticated' };

    // Immediately update profile in memory for zero-lag UI response
    setProfile((prev) => ({
      ...(prev || {}),
      passenger_category: newCategory
    }));

    try {
      localStorage.setItem(`qcbus_user_category_${user.id}`, newCategory);
    } catch (_) {}

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ passenger_category: newCategory, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .maybeSingle();

      if (data) {
        setProfile(data);
      }
      return { success: true, data: data || { passenger_category: newCategory } };
    } catch (err) {
      console.warn('[AuthContext] Category updated locally, remote sync notice:', err.message);
      return { success: true, data: { passenger_category: newCategory } };
    }
  };

  const signOut = async () => {
    if (user?.is_anonymous || String(user?.id || '').startsWith('local-')) {
      return { success: true };
    }
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setSession(null);
      setProfile(null);
      return { success: true };
    } catch (err) {
      console.error('[AuthContext] signOut error:', err.message);
      return { success: false, error: err.message };
    }
  };

  // Formatted user object for application consumption
  const providerName = user?.app_metadata?.provider 
    ? `${user.app_metadata.provider.toUpperCase()} Account` 
    : 'Supabase Email Auth';

  // Helper to reliably extract the user's first name
  const extractFirstName = (rawName, email) => {
    if (rawName && typeof rawName === 'string' && rawName.trim()) {
      return rawName.trim().split(/\s+/)[0];
    }
    if (email && typeof email === 'string') {
      const handle = email.split('@')[0];
      return handle.charAt(0).toUpperCase() + handle.slice(1);
    }
    return 'Commuter';
  };

  const resolvedFullName = profile?.full_name 
    || user?.user_metadata?.full_name 
    || user?.user_metadata?.name 
    || user?.user_metadata?.given_name
    || (user?.email ? user.email.split('@')[0] : 'Commuter Passenger');

  const resolvedFirstName = extractFirstName(resolvedFullName, user?.email);

  const formattedUser = user ? {
    id: user.id,
    name: resolvedFullName,
    firstName: resolvedFirstName,
    email: user.email,
    category: profile?.passenger_category || (typeof window !== 'undefined' ? localStorage.getItem(`qcbus_user_category_${user.id}`) : null) || user.user_metadata?.passenger_category || 'Regular',
    provider: providerName,
    avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture
  } : null;

  const value = {
    user,
    session,
    profile,
    currentUser: formattedUser,
    loading,
    authError,
    profileError,
    retryProfile,
    isAuthenticated: !!user,
    signOut,
    updateCategory
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
