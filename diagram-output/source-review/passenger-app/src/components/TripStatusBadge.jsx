/**
 * TripStatusBadge Component (React / JSX)
 * Colored pill indicator for trip operation states.
 */
import React from 'react';

export function TripStatusBadge({ status }) {
  const normalized = (status || '').toUpperCase();

  let className = 'status-pill status-scheduled';
  let label = status || 'Scheduled';
  let showPulse = false;

  switch (normalized) {
    case 'IN_TRANSIT':
      className = 'status-pill status-in_transit';
      label = 'In Transit';
      showPulse = true;
      break;
    case 'SCHEDULED':
      className = 'status-pill status-scheduled';
      label = 'Scheduled';
      break;
    case 'COMPLETED':
      className = 'status-pill status-completed';
      label = 'Completed';
      break;
    case 'DELAYED':
      className = 'status-pill status-delayed';
      label = 'Delayed';
      break;
    case 'CANCELLED':
      className = 'status-pill status-cancelled';
      label = 'Cancelled';
      break;
  }

  return (
    <span className={className}>
      {showPulse && <span className="pulse-dot"></span>}
      {label}
    </span>
  );
}
