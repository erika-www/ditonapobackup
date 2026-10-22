import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminRoutes, getAdminStops, getAdminBuses, getAdminTrips, getHealthDB } from '../services/api';

export function DashboardPage() {
  const [stats, setStats] = useState({
    routesCount: 0,
    stopsCount: 0,
    busesCount: 0,
    tripsCount: 0,
    dbStatus: 'checking...',
    dbEngine: 'PostgreSQL',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const [routes, stops, buses, trips, health] = await Promise.all([
          getAdminRoutes().catch(() => []),
          getAdminStops().catch(() => []),
          getAdminBuses().catch(() => []),
          getAdminTrips().catch(() => []),
          getHealthDB().catch(() => ({ status: 'offline', database: 'unknown' })),
        ]);

        setStats({
          routesCount: routes.length,
          stopsCount: stops.length,
          busesCount: buses.length,
          tripsCount: trips.length,
          dbStatus: health.status === 'connected' ? 'Online' : 'Offline',
          dbEngine: health.database,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>System Dashboard</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Database statistics and operational overview for QC Bus System.</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/import" className="btn btn-secondary">
            Import Dataset
          </Link>
          <Link to="/routes" className="btn btn-primary">
            Add New Route
          </Link>
        </div>
      </div>

      {/* Database Connection Banner */}
      <div className="stat-card" style={{ marginBottom: '1.5rem', backgroundColor: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Authoritative Database Status</div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Central PostgreSQL Database | FastAPI Backend</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.15)', padding: '0.35rem 0.85rem', borderRadius: '4px', color: '#34d399', fontWeight: 700, fontSize: '0.85rem' }}>
          {stats.dbStatus} ({stats.dbEngine})
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderRadius: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8' }}>
            <span>Total Bus Routes</span>
          </div>
          <div className="stat-number">{loading ? '...' : stats.routesCount}</div>
        </div>

        <div className="stat-card" style={{ borderRadius: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8' }}>
            <span>Total Designated Stops</span>
          </div>
          <div className="stat-number">{loading ? '...' : stats.stopsCount}</div>
        </div>

        <div className="stat-card" style={{ borderRadius: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8' }}>
            <span>Fleet Units</span>
          </div>
          <div className="stat-number">{loading ? '...' : stats.busesCount}</div>
        </div>

        <div className="stat-card" style={{ borderRadius: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#94a3b8' }}>
            <span>Logged Trips</span>
          </div>
          <div className="stat-number">{loading ? '...' : stats.tripsCount}</div>
        </div>
      </div>

      {/* Quick Action Management Panel */}
      <div className="stat-card" style={{ marginTop: '2rem', borderRadius: '6px' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Administrative Modules</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <Link to="/routes" style={{ padding: '1rem', background: 'var(--bg-subtle)', borderRadius: '4px', border: '1px solid var(--border-color)', display: 'block' }}>
            <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Routes & Sequence -&gt;
            </div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Create, edit, and reorder stop sequence numbers.</div>
          </Link>

          <Link to="/stops" style={{ padding: '1rem', background: 'var(--bg-subtle)', borderRadius: '4px', border: '1px solid var(--border-color)', display: 'block' }}>
            <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Bus Stops -&gt;
            </div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Manage stop locations, codes, and GPS coordinates.</div>
          </Link>

          <Link to="/import" style={{ padding: '1rem', background: 'var(--bg-subtle)', borderRadius: '4px', border: '1px solid var(--border-color)', display: 'block' }}>
            <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Dataset Importer -&gt;
            </div>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Preview and import CSV/JSON datasets with validation report.</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
