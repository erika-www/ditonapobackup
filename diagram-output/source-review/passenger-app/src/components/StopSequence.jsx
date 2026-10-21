/**
 * StopSequence Component (React / JSX)
 * Vertical timeline for stop sequence ordering and travel ETAs.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock } from 'lucide-react';

export function StopSequence({ stops }) {
  if (!stops || stops.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
        No ordered stops sequence found for this route yet.
      </div>
    );
  }

  return (
    <div className="timeline">
      {stops.map((item, idx) => {
        const stop = item.stop || item;
        const sequenceNum = item.stop_sequence || idx + 1;
        return (
          <div key={item.id || idx} className="timeline-item">
            <div className="timeline-node">{sequenceNum}</div>
            <div className="timeline-content">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  {stop && stop.id ? (
                    <Link to={`/stops/${stop.id}`} className="timeline-title">
                      {stop.stop_name || stop.name}
                    </Link>
                  ) : (
                    <span className="timeline-title">{stop.stop_name || stop.name || `Stop #${sequenceNum}`}</span>
                  )}
                  {stop?.stop_code && (
                    <span style={{ fontSize: '0.75rem', color: '#06b6d4', marginLeft: '0.5rem', background: 'rgba(6, 182, 212, 0.12)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                      {stop.stop_code}
                    </span>
                  )}
                </div>

                {item.estimated_travel_minutes != null && (
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={14} /> +{item.estimated_travel_minutes} mins
                  </span>
                )}
              </div>

              {(stop?.address || stop?.landmark) && (
                <div className="timeline-sub" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.35rem' }}>
                  <MapPin size={14} color="#64748b" />
                  {stop.landmark ? `Landmark: ${stop.landmark}` : stop.address}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
