/**
 * SearchBar Component (React / JSX)
 * Real-time text filter bar with instant clear button.
 */
import React from 'react';
import { Search, X } from 'lucide-react';

export function SearchBar({ value, onChange, placeholder = 'Search routes, bus stops, or addresses...' }) {
  return (
    <div className="search-container">
      <Search className="search-icon" size={20} />
      <input
        type="text"
        className="search-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          style={{
            position: 'absolute',
            right: '1.25rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#94a3b8',
            padding: '0.2rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
