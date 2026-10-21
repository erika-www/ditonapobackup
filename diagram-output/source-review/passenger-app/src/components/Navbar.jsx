/**
 * Navigation Bar Component (React / JSX)
 * Header bar providing theme toggling, navigation links, and account controls.
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bus, Sun, Moon, LogIn, Play } from 'lucide-react';
import placeholderImg from '../../assets/placeholder.jpg';
import { useAuth } from '../context/AuthContext';

export function Navbar({
  theme,
  onToggleTheme,
  currentUser,
  onOpenAuth,
  onOpenProfile,
  onStartTrip,
  isTripActive,
  isInTripDashboard
}) {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  // Single source of truth: the Supabase-backed AuthContext
  const { currentUser: authUser, loading: authLoading } = useAuth();
  const activeUser = authUser || currentUser;
  const firstName = activeUser?.firstName 
    || (activeUser?.name ? activeUser.name.trim().split(/\s+/)[0] : '')
    || (activeUser?.email ? activeUser.email.split('@')[0] : 'Passenger');

  return (
    <header style={{
      width: '100%',
      backgroundColor: 'var(--bg-glass)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky',
      top: 0,
      zIndex: 900,
      transition: 'background-color 0.3s ease'
    }}>
      <div style={{
        width: '100%',
        padding: '0.85rem 2.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1.5rem'
      }}>
        {/* Logo Branding */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            backgroundColor: 'var(--primary)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)'
          }}>
            <img src={placeholderImg} alt="DITO NA PO Logo" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', lineHeight: 1.1, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
              DITO NA PO
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Quezon City Bus Navigation
            </div>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3rem', flex: 1 }}>
          <Link
            to="/"
            style={{
              fontWeight: 600,
              fontSize: '20px',
              color: isActive('/') ? 'var(--primary)' : 'var(--text-secondary)',
              transition: 'color 0.2s'
            }}
          >
            Home
          </Link>
          <Link
            to="/where-to-go"
            style={{
              fontWeight: 600,
              fontSize: '20px',
              color: isActive('/where-to-go') ? 'var(--primary)' : 'var(--text-secondary)',
              transition: 'color 0.2s'
            }}
          >
            Where to Go?
          </Link>
          <Link
            to="/about"
            style={{
              fontWeight: 600,
              fontSize: '20px',
              color: isActive('/about') ? 'var(--primary)' : 'var(--text-secondary)',
              transition: 'color 0.2s'
            }}
          >
            About
          </Link>
        </nav>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-subtle)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun size={18} style={{ color: '#f59e0b' }} /> : <Moon size={18} style={{ color: '#475569' }} />}
          </button>

          {/* User Account / Auth Modal Trigger: Replaces 'Log In / Sign Up' with user's first name */}
          {activeUser ? (
            <button
              id="navbar-user-btn"
              type="button"
              onClick={onOpenProfile}
              title="Open profile and settings"
              className="btn-secondary"
              style={{
                padding: '0.45rem 0.95rem',
                fontSize: '0.88rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                borderColor: 'var(--primary)',
                color: 'var(--primary)',
                backgroundColor: 'var(--bg-subtle)',
                cursor: 'pointer'
              }}
            >
              {activeUser.avatar_url ? (
                <img
                  src={activeUser.avatar_url}
                  alt={firstName}
                  referrerPolicy="no-referrer"
                  style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
                    color: '#fff',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800
                  }}
                >
                  {firstName.charAt(0).toUpperCase()}
                </div>
              )}
              <span>{firstName}</span>
            </button>
          ) : authLoading ? (
            <div style={{ width: '120px', height: '34px' }} aria-hidden="true" />
          ) : (
            <button
              id="navbar-login-btn"
              type="button"
              onClick={onOpenAuth}
              className="btn-secondary"
              style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
            >
              <LogIn size={16} /> Log In / Sign Up
            </button>
          )}

          {/* Start Trip Action Button */}
          {!isInTripDashboard && <button
            onClick={onStartTrip}
            className={isTripActive ? 'btn-success' : 'btn-primary'}
            style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
          >
            {isTripActive ? (
              <>
                <span className="pulse-dot" style={{ backgroundColor: '#fff' }}></span>
                Trip Active
              </>
            ) : (
              <>
                <Play size={16} fill="currentColor" /> Start Trip
              </>
            )}
          </button>}
        </div>
      </div>
    </header>
  );
}
