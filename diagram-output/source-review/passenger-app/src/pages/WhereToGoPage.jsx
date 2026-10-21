import React, { useState } from 'react';
import { Compass, MapPin, Landmark, Building, GraduationCap, Hospital, ShoppingBag } from 'lucide-react';
import { LANDMARK_SPOTS, QC_ROUTES } from '../mockData';

export function WhereToGoPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['All', 'Tourist Spot', 'Landmark', 'Government Office', 'University', 'Hospital', 'Mall'];

  const filteredLandmarks = LANDMARK_SPOTS.filter(spot => {
    const matchesCategory = selectedCategory === 'All' || spot.category === selectedCategory;
    const matchesQuery = spot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spot.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spot.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Tourist Spot': return <Compass size={18} style={{ color: 'var(--primary)' }} />;
      case 'Landmark': return <Landmark size={18} style={{ color: 'var(--secondary)' }} />;
      case 'Government Office': return <Building size={18} style={{ color: 'var(--warning)' }} />;
      case 'University': return <GraduationCap size={18} style={{ color: '#8b5cf6' }} />;
      case 'Hospital': return <Hospital size={18} style={{ color: '#ec4899' }} />;
      case 'Mall': return <ShoppingBag size={18} style={{ color: '#06b6d4' }} />;
      default: return <MapPin size={18} />;
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header Banner */}
      <div className="glass-card" style={{ backgroundColor: 'var(--bg-subtle)' }}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>
          Where to Go in Quezon City?
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '750px' }}>
          Explore iconic landmarks, government services, top universities, and vibrant tourist spots accessible 100% free via QC Bus routes!
        </p>

        {/* Search & Filter bar */}
        <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search landmarks, spots, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ maxWidth: '360px' }}
          />

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Spots */}
      <div className="grid-2">
        {filteredLandmarks.map(spot => {
          const route = QC_ROUTES.find(r => r.id === spot.routeId);
          return (
            <div key={spot.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <span className="badge-live" style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--text-primary)' }}>
                    {getCategoryIcon(spot.category)} {spot.category}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{spot.name}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  📍 {spot.address}
                </p>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  {spot.description}
                </p>
              </div>

              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
                <strong style={{ color: 'var(--primary)' }}>Nearest Bus Stop:</strong> {spot.nearestStop}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
