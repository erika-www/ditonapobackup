/** Duty check-in and administrator access for the QC Bus Admin portal. */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchOperationsPersonnel } from '../services/supabaseClient';
import { ShieldCheck, User } from 'lucide-react';

export function LoginPage() {
  const [personnel, setPersonnel] = useState([]);
  const [driverPersonnelId, setDriverPersonnelId] = useState('DRV-1024');
  const [conductorPersonnelId, setConductorPersonnelId] = useState('CND-2048');
  const [dispatcherPersonnelId, setDispatcherPersonnelId] = useState('');
  const [plateNumber, setPlateNumber] = useState('QC-BUS-0402');
  const [busCapacity, setBusCapacity] = useState('50');
  const [tripDirection, setTripDirection] = useState('Northbound');
  const [error, setError] = useState('');
  const [personnelError, setPersonnelError] = useState('');
  const [loadingPersonnel, setLoadingPersonnel] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { login, isAuthenticated, isTestMode, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Registered or default fallback personnel options
  const defaultDrivers = useMemo(() => [
    { id: 'def-drv-1', personnel_id: 'DRV-1024', full_name: 'Juan Dela Cruz' },
    { id: 'def-drv-2', personnel_id: 'DRV-1035', full_name: 'Ramon Mercado' },
    { id: 'def-drv-3', personnel_id: 'DRV-1042', full_name: 'Danilo Santos' }
  ], []);

  const defaultConductors = useMemo(() => [
    { id: 'def-cnd-1', personnel_id: 'CND-2048', full_name: 'Pedro Reyes' },
    { id: 'def-cnd-2', personnel_id: 'CND-2055', full_name: 'Carlo Mendoza' },
    { id: 'def-cnd-3', personnel_id: 'CND-2060', full_name: 'Arnel Bautista' }
  ], []);

  const drivers = useMemo(() => {
    const list = personnel.filter((person) => person.personnel_type === 'driver');
    return list.length ? list : defaultDrivers;
  }, [personnel, defaultDrivers]);

  const conductors = useMemo(() => {
    const list = personnel.filter((person) => person.personnel_type === 'conductor');
    return list.length ? list : defaultConductors;
  }, [personnel, defaultConductors]);

  const dispatchers = useMemo(() => {
    return personnel.filter((person) => person.personnel_type === 'dispatcher');
  }, [personnel]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return undefined;
    let active = true;
    setLoadingPersonnel(true);
    setPersonnelError('');
    fetchOperationsPersonnel({ activeOnly: false }).then((result) => {
      if (!active) return;
      if (result.success && result.data.length) {
        setPersonnel(result.data);
      }
    }).catch(() => {
      // Fallback defaults will be used seamlessly
    }).finally(() => {
      if (active) setLoadingPersonnel(false);
    });
    return () => { active = false; };
  }, [authLoading, isAuthenticated]);

  const handleDutySubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login({
        driverPersonnelId: driverPersonnelId || 'DRV-1024',
        conductorPersonnelId: conductorPersonnelId || 'CND-2048',
        dispatcherPersonnelId,
        plateNumber: plateNumber.trim().toUpperCase() || 'QC-BUS-0402',
        busCapacity: busCapacity || '50',
        tripDirection
      });
      navigate('/');
    } catch (err) {
      setError(err.message || 'Could not start the duty session.');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldStyle = { width: '100%' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-dark)', padding: '1.5rem' }}>
      <div className="modal-content" style={{ maxWidth: '560px', padding: '2.25rem', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <ShieldCheck size={44} color="#06b6d4" style={{ margin: '0 auto 0.5rem' }} />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>DITO NA PO</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem' }}>QC Bus Operations & Duty Personnel Portal</p>
        </div>

        {error && <div className="alert alert-danger" style={{ marginBottom: '1rem', padding: '.75rem 1rem', fontSize: '.85rem' }}>{error}</div>}
        {personnelError && <div className="alert alert-danger" role="alert" style={{ marginBottom: '1rem', padding: '.75rem 1rem', fontSize: '.85rem' }}>{personnelError}</div>}
        
        {!authLoading && !isAuthenticated && !isTestMode ? (
          <div className="alert alert-info" role="status" style={{ marginBottom: '1rem', padding: '.75rem 1rem', fontSize: '.85rem', lineHeight: '1.6' }}>
            An administrator must sign in on this web app before personnel start duty.{' '}
            <Link to="/admin-login" state={{ target: 'personnel', from: '/login' }} style={{ color: '#67e8f9', fontWeight: 700, textDecoration: 'underline' }}>
              Sign in as Admin
            </Link> to unlock immediate personnel check-in.
          </div>
        ) : (
          <div style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '8px', padding: '.65rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem', color: '#67e8f9', fontSize: '.85rem', flexWrap: 'wrap' }}>
            <span>{isTestMode ? 'Local GPS test mode is active. Database writes still require Supabase authentication.' : '✓ Admin session authorized. Personnel can proceed to duty check-in.'}</span>
            <Link to="/admin" style={{ color: '#38bdf8', fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap' }}>
              Go to Admin Portal →
            </Link>
          </div>
        )}

        <form onSubmit={handleDutySubmit}>
          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '1.25rem', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '.85rem', color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
              <User size={18} /> Bus Personnel & Vehicle Details
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.85rem' }}>
              <div className="form-group">
                <label className="form-label">Driver</label>
                <select 
                  className="form-select" 
                  style={fieldStyle} 
                  value={driverPersonnelId} 
                  onChange={(e) => setDriverPersonnelId(e.target.value)} 
                  required 
                  disabled={!isAuthenticated && !isTestMode}
                >
                  {drivers.map((person) => (
                    <option key={person.id} value={person.personnel_id}>
                      {person.full_name} ({person.personnel_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Conductor</label>
                <select 
                  className="form-select" 
                  style={fieldStyle} 
                  value={conductorPersonnelId} 
                  onChange={(e) => setConductorPersonnelId(e.target.value)} 
                  required 
                  disabled={!isAuthenticated && !isTestMode}
                >
                  {conductors.map((person) => (
                    <option key={person.id} value={person.personnel_id}>
                      {person.full_name} ({person.personnel_id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Plate Number</label>
                <input 
                  type="text" 
                  className="form-input" 
                  style={fieldStyle} 
                  placeholder="e.g. QC-BUS-0402" 
                  value={plateNumber} 
                  onChange={(e) => setPlateNumber(e.target.value)} 
                  required 
                  disabled={!isAuthenticated && !isTestMode}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Bus Capacity</label>
                <input 
                  type="number" 
                  className="form-input" 
                  style={fieldStyle} 
                  min={10} 
                  max={120} 
                  value={busCapacity} 
                  onChange={(e) => setBusCapacity(e.target.value)} 
                  required 
                  disabled={!isAuthenticated && !isTestMode}
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Trip Direction</label>
                <select 
                  className="form-select" 
                  style={fieldStyle} 
                  value={tripDirection} 
                  onChange={(e) => setTripDirection(e.target.value)} 
                  required
                  disabled={!isAuthenticated && !isTestMode}
                >
                  <option value="Northbound">Northbound (QC Hall to General Luis)</option>
                  <option value="Southbound">Southbound (General Luis to QC Hall)</option>
                </select>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', justifyContent: 'center', padding: '.85rem', fontSize: '1rem', fontWeight: 700 }} 
            disabled={submitting || (!isAuthenticated && !isTestMode)}
          >
            {submitting ? 'Starting Duty...' : 'Confirm & Start Duty'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
          {isAuthenticated ? (
            <Link to="/admin" style={{ color: '#06b6d4', fontWeight: 700, textDecoration: 'none' }}>
              Access Admin Exclusive Portal -&gt;
            </Link>
          ) : isTestMode ? (
            <span style={{ color: '#06b6d4', fontWeight: 700 }}>Local GPS testing mode is active.</span>
          ) : (
            <Link to="/admin-login" state={{ target: 'admin', from: '/login' }} style={{ color: '#06b6d4', fontWeight: 700, textDecoration: 'none' }}>
              Are you an Admin? Log in to Admin Portal -&gt;
            </Link>
          )}
          <div style={{ marginTop: '.7rem' }}>
            <Link to="/personnel-request" style={{ color: '#94a3b8', fontSize: '.86rem', textDecoration: 'none' }}>
              Need to register as bus personnel? Submit a request
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
