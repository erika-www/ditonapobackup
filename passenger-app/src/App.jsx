import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { WhereToGoPage } from './pages/WhereToGoPage';
import { AboutPage } from './pages/AboutPage';
import { StartTripInterface } from './components/StartTripInterface';
import { AuthProvider, useAuth } from './context/AuthContext';

export function AppContent() {
  const { currentUser, signOut, updateCategory, loading, authError, profileError, retryProfile } = useAuth();

  // Theme State (Default to 'light' mode and persist in localStorage)
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('qcbus_theme');
    return savedTheme ? savedTheme : 'light';
  });
  
  // Text Size State ('small' | 'normal' | 'large')
  const [textSize, setTextSize] = useState(() => {
    const savedSize = localStorage.getItem('qcbus_text_size');
    return savedSize ? savedSize : 'normal';
  });

  // Language State ('en' | 'fil')
  const [language, setLanguage] = useState(() => {
    const savedLang = localStorage.getItem('qcbus_language');
    return savedLang ? savedLang : 'en';
  });

  const [accessibility, setAccessibility] = useState('standard');


  // Active Trip State
  const [activeTrip, setActiveTrip] = useState(null);
  const [inTripDashboard, setInTripDashboard] = useState(false);

  // Toast notifications
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, kind) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Surface OAuth/config errors instead of silently showing a logged-out UI
  useEffect(() => {
    if (authError) {
      setToastMessage(`Sign-in problem: ${authError}`);
      const id = setTimeout(() => setToastMessage(null), 9000);
      return () => clearTimeout(id);
    }
  }, [authError]);

  const handleUpdateCategory = async (newCategory) => {
    if (currentUser) {
      const res = await updateCategory(newCategory);
      if (res.success) {
        // Category changes are reflected directly in the profile.
      } else {
        console.error('Failed to update passenger category:', res.error);
      }
    }
  };

  // Sync dataset attributes on root document for CSS variables and save settings
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-text-size', textSize);
    document.documentElement.setAttribute('data-accessibility', accessibility);
    localStorage.setItem('qcbus_theme', theme);
    localStorage.setItem('qcbus_text_size', textSize);
    localStorage.setItem('qcbus_language', language);
  }, [theme, textSize, language, accessibility]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('qcbus_theme', nextTheme);
    showToast(`Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} Mode`);
  };

  const handleChangeTextSize = (newSize) => {
    setTextSize(newSize);
    localStorage.setItem('qcbus_text_size', newSize);
    showToast(`Text sizing set to ${newSize.toUpperCase()}`);
  };

  const handleChangeLanguage = (newLang) => {
    setLanguage(newLang);
    localStorage.setItem('qcbus_language', newLang);
    showToast(`App language set to ${newLang === 'en' ? 'English' : 'Filipino (Tagalog)'}`);
  };

  // Auth trigger source: 'NAVBAR' | 'START_TRIP'
  const [dashboardTab, setDashboardTab] = useState('home');
  const [startTripRequestId, setStartTripRequestId] = useState(0);

  const handleOpenAuthFromNavbar = () => {
    setDashboardTab('profile');
    setInTripDashboard(true);
  };

  const handleOpenProfile = () => {
    setDashboardTab('profile');
    setInTripDashboard(true);
  };

  const handleOpenPassengerDashboard = () => {
    setDashboardTab('dashboard');
    setInTripDashboard(true);
  };

  const handleStartTripClick = () => {
    setDashboardTab('home');
    setStartTripRequestId((current) => current + 1);
    setInTripDashboard(true);
  };

  const handleLogout = async () => {
    await signOut();
    setInTripDashboard(false);
    setActiveTrip(null);
  };

  return (
    <div className="app-container">
      {/* Authentication Modal */}
      {/* Navigation Header - Always visible across all views */}
      {profileError && <div role="alert" style={{ padding: '.75rem 1rem', background: '#fff7ed', color: '#9a3412', textAlign: 'center' }}>
        Signed in, but profile access failed: {profileError}{' '}
        <button type="button" onClick={retryProfile} style={{ marginLeft: '.5rem', textDecoration: 'underline', background: 'none', border: 0, color: 'inherit', cursor: 'pointer' }}>Retry profile</button>
      </div>}
      {!inTripDashboard && <Navbar
        theme={theme}
        onToggleTheme={toggleTheme}
        currentUser={currentUser}
        onOpenAuth={handleOpenAuthFromNavbar}
        onOpenProfile={handleOpenProfile}
        onStartTrip={handleStartTripClick}
        isTripActive={!!activeTrip}
        isInTripDashboard={inTripDashboard}
      />}

      {/* Main View Area */}
      <main className="main-content">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div className="spinner" style={{ marginBottom: '1rem' }}>Checking authentication session...</div>
          </div>
        ) : inTripDashboard && currentUser ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingTop: '0.25rem' }}>
              <button type="button" onClick={() => setInTripDashboard(false)} className="btn-secondary" style={{ fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 1rem' }}>
                Return
              </button>
            </div>

            <StartTripInterface
              initialTab={dashboardTab}
              startTripRequestId={startTripRequestId}
              currentUser={currentUser}
              onUpdateCategory={handleUpdateCategory}
              onLogout={handleLogout}
              theme={theme}
              onToggleTheme={toggleTheme}
              textSize={textSize}
              onChangeTextSize={handleChangeTextSize}
              language={language}
              onChangeLanguage={handleChangeLanguage}
              accessibility={accessibility}
              onToggleAccessibility={setAccessibility}
              activeTrip={activeTrip}
              setActiveTrip={setActiveTrip}
              onShowToast={showToast}
            />
          </div>
        ) : (
          <Routes>
            <Route
              path="/"
              element={
                <HomePage
                  onStartTrip={handleStartTripClick}
                  onOpenPassengerDashboard={handleOpenPassengerDashboard}
                  onSelectRoutePreview={() => { }}
                />
              }
            />
            <Route path="/where-to-go" element={<WhereToGoPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route
              path="*"
              element={
                <HomePage
                  onStartTrip={handleStartTripClick}
                  onOpenPassengerDashboard={handleOpenPassengerDashboard}
                  onSelectRoutePreview={() => { }}
                />
              }
            />
          </Routes>
        )}
      </main>

      {/* Footer */}
      {!inTripDashboard && <Footer />}

      {/* Toast Popup Notification */}
      {toastMessage && (
        <div className="toast-container">
          <div className="toast">
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
}

export function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}
