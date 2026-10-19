/**
 * App Component (React / JSX)
 * Administrative portal main layout and router configuration.
 */
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { RouteInformationPage } from './pages/RouteInformationPage';
import { PassengerCheckInPage } from './pages/PassengerCheckInPage';
import { DailyTripSummaryPage } from './pages/DailyTripSummaryPage';
import { SettingsPage } from './pages/SettingsPage';
import { StopsAdminPage } from './pages/StopsAdminPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { PersonnelRequestPage } from './pages/PersonnelRequestPage';
import { PersonnelRegistrationPage } from './pages/PersonnelRegistrationPage';
import { PersonnelRequestsPage } from './pages/PersonnelRequestsPage';
import { AdminSignupRequestsPage } from './pages/AdminSignupRequestsPage';
import { useAuth } from './context/AuthContext';

function LoginRoute({ page }) {
  return page;
}

function AdminPortal() {
  return (
    <div className="admin-layout">
      <Sidebar adminMode />
      <main className="admin-main">
        <Routes>
          <Route index element={<AdminDashboardPage />} />
          <Route path="personnel" element={<PersonnelRegistrationPage />} />
          <Route path="personnel-requests" element={<PersonnelRequestsPage />} />
          <Route path="admin-requests" element={<AdminSignupRequestsPage />} />
          <Route path="route-stops" element={<StopsAdminPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function DutyPortal() {
  const { isAuthenticated, isTestMode, isDutyRegistered, loading } = useAuth();
  if (loading) return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#090d16', color: '#06b6d4' }}>Verifying duty session…</div>;
  if (!isAuthenticated && !isTestMode) return <Navigate to="/login" replace />;
  if (!isDutyRegistered) return <Navigate to="/login" replace />;

  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-main">
        <Routes>
          <Route path="/" element={<RouteInformationPage />} />
          <Route path="/check-in" element={<PassengerCheckInPage />} />
          <Route path="/summary" element={<DailyTripSummaryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginRoute page={<LoginPage />} />} />
          <Route path="/admin-login" element={<LoginRoute page={<AdminLoginPage />} />} />
          <Route path="/personnel-request" element={<PersonnelRequestPage />} />
          <Route path="/admin/*" element={<ProtectedRoute redirectTo="/admin-login"><AdminPortal /></ProtectedRoute>} />
          <Route path="/*" element={<DutyPortal />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
