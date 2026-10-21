/**
 * EmptyState Component (React / JSX)
 * Friendly placeholder when search or data queries return no results.
 */
import React from 'react';
import { SearchX } from 'lucide-react';

export function EmptyState({
  title = 'No Records Found',
  message = 'Try adjusting your search criteria or explore other QC Bus routes.'
}) {
  return (
    <div className="empty-state">
      <SearchX size={44} color="#64748b" style={{ margin: '0 auto' }} />
      <h3 className="empty-title">{title}</h3>
      <p style={{ fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto' }}>{message}</p>
    </div>
  );
}
