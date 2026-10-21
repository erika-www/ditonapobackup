import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ArrowRight } from 'lucide-react';

export function RouteCard({ route }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="route-code-badge">{route.route_code || route.code}</span>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
          {route.data_source || 'QC Transit'}
        </span>
      </div>

      <h3 className="card-title">{route.route_name || route.name}</h3>
      <p className="card-desc">{route.description || 'No description available for this route.'}</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <MapPin size={16} />
          {route.stop_count ?? route.stops?.length ?? 0} Designated Stops
        </span>

        <Link
          to={`/routes/${route.id}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: '#38bdf8',
          }}
        >
          View Sequence <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
