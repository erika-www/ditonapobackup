/**
 * ProtectedRoute Component (React / JSX)
 * Route wrapper that redirects unauthenticated visitors to /login.
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute({ children, redirectTo = '/admin-login' }) {
  const { isAuthenticated, isTestMode, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#090d16' }}>
        <div style={{ color: '#06b6d4', fontSize: '1rem', fontWeight: 600 }}>Verifying Administrator Session...</div>
      </div>
    );
  }

  if (!isAuthenticated && !isTestMode) {
    return <Navigate to={redirectTo} state={{ target: 'admin', from: '/admin' }} replace />;
  }

  return <>{children}</>;
}
