import React, { useState, useMemo } from 'react';
import { Users, Clock, TrendingUp, ChevronDown, ChevronUp, Sparkles, Filter, Search } from 'lucide-react';
import { getStopQueueSchedule } from '@shared/queueAndBoardingService';

export function StopQueuePredictor({ selectedStop, direction = 'Northbound' }) {
  const [showTrends, setShowTrends] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'morning' | 'midday' | 'evening' | 'night'
  const [searchTime, setSearchTime] = useState('');

  // Fetch predictions for the selected starting stop
  const queueData = useMemo(() => {
    if (!selectedStop) return null;
    return getStopQueueSchedule(selectedStop);
  }, [selectedStop]);

  if (!queueData || !queueData.slots || queueData.slots.length === 0) {
    return null;
  }

  const { slots, currentSlot, summary, canonicalName, shortName } = queueData;
  const activeSlot = currentSlot || slots[0];

  // Filter slots when user expands other time slot trends
  const filteredSlots = useMemo(() => {
    let result = slots;
    if (activeFilter === 'morning') {
      result = result.filter(s => s.period === 'Morning Peak');
    } else if (activeFilter === 'midday') {
      result = result.filter(s => s.period === 'Midday Off-Peak');
    } else if (activeFilter === 'evening') {
      result = result.filter(s => s.period === 'Evening Peak');
    } else if (activeFilter === 'night') {
      result = result.filter(s => s.period === 'Night');
    }

    if (searchTime.trim()) {
      const q = searchTime.trim().toLowerCase();
      result = result.filter(s => s.label.toLowerCase().includes(q) || s.startTime.includes(q) || s.endTime.includes(q));
    }
    return result;
  }, [slots, activeFilter, searchTime]);

  const getCrowdBg = (level) => {
    if (level === 'High') return 'rgba(239, 68, 68, 0.12)';
    if (level === 'Moderate') return 'rgba(245, 158, 11, 0.12)';
    return 'rgba(16, 185, 129, 0.12)';
  };

  const getCrowdBorder = (level) => {
    if (level === 'High') return 'rgba(239, 68, 68, 0.35)';
    if (level === 'Moderate') return 'rgba(245, 158, 11, 0.35)';
    return 'rgba(16, 185, 129, 0.35)';
  };

  return (
    <div style={{
      marginTop: '1rem',
      borderRadius: 'var(--radius-lg, 12px)',
      border: '1px solid var(--border-color, #e2e8f0)',
      background: 'var(--bg-card, #ffffff)',
      padding: '1.1rem 1.25rem',
      boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.85rem'
    }}>
      {/* Top Header: Stop Name & AI Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.2rem 0.55rem',
            borderRadius: '9999px',
            fontSize: '0.72rem',
            fontWeight: 700,
            backgroundColor: 'rgba(139, 92, 246, 0.12)',
            color: '#7c3aed',
            border: '1px solid rgba(139, 92, 246, 0.25)'
          }}>
            <Sparkles size={12} /> Random Forest Forecast
          </span>
          <strong style={{ fontSize: '0.92rem', color: 'var(--text-main, #0f172a)' }}>
            Predicted Queue · {shortName || canonicalName}
          </strong>
        </div>

        <div style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          padding: '0.15rem 0.5rem',
          borderRadius: '6px',
          backgroundColor: activeSlot.isUpcoming ? 'rgba(59, 130, 246, 0.12)' : (activeSlot.isClosed ? 'rgba(100, 116, 139, 0.12)' : 'rgba(16, 185, 129, 0.12)'),
          color: activeSlot.isUpcoming ? '#2563eb' : (activeSlot.isClosed ? '#64748b' : '#059669'),
          border: `1px solid ${activeSlot.isUpcoming ? 'rgba(59, 130, 246, 0.25)' : (activeSlot.isClosed ? 'rgba(100, 116, 139, 0.25)' : 'rgba(16, 185, 129, 0.25)')}`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem'
        }}>
          {activeSlot.isUpcoming ? '⏰ Upcoming Operating Window' : (activeSlot.isClosed ? '🌙 After Operating Hours' : '● Current Window')}
        </div>
      </div>

      {/* Primary Display: Current Time Period Predicted Queue Only */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.85rem 1.1rem',
        borderRadius: '10px',
        backgroundColor: getCrowdBg(activeSlot.crowdLevel),
        border: `1.5px solid ${getCrowdBorder(activeSlot.crowdLevel)}`,
        flexWrap: 'wrap',
        gap: '0.85rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            backgroundColor: activeSlot.crowdColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            flexShrink: 0,
            boxShadow: `0 2px 8px ${activeSlot.crowdColor}55`
          }}>
            <Users size={22} />
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted, #64748b)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Clock size={13} color="var(--primary, #0284c7)" />
              Current Time Slot: <strong>{activeSlot.label}</strong> ({activeSlot.duration}m interval)
            </div>
            <div style={{ fontSize: '1.28rem', fontWeight: 800, color: 'var(--text-main, #0f172a)', lineHeight: 1.25 }}>
              ~{activeSlot.predictedQueue} passengers in queue
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{
            padding: '0.3rem 0.75rem',
            borderRadius: '9999px',
            backgroundColor: activeSlot.crowdColor,
            color: '#ffffff',
            fontSize: '0.78rem',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}>
            {activeSlot.crowdLevel} Crowd
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary, #475569)', fontWeight: 600 }}>
            ~{activeSlot.avgQueuePerBus} pax / arriving bus
          </div>
        </div>
      </div>

      {/* Option to View Other Time Slot Queue Trends */}
      <button
        type="button"
        onClick={() => setShowTrends(!showTrends)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          padding: '0.65rem 1rem',
          fontSize: '0.84rem',
          fontWeight: 700,
          borderRadius: '8px',
          border: showTrends ? '1px solid var(--primary, #0284c7)' : '1px solid var(--border-color, #cbd5e1)',
          backgroundColor: showTrends ? 'rgba(2, 132, 199, 0.08)' : 'var(--bg-subtle, #f8fafc)',
          color: 'var(--primary, #0284c7)',
          cursor: 'pointer',
          transition: 'all 0.18s ease'
        }}
      >
        <TrendingUp size={15} />
        {showTrends ? 'Hide Other Time Slot Trends' : 'View Other Time Slot Passenger Queue Trends'}
        {showTrends ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Collapsible Section: Only shown when the user clicks the option */}
      {showTrends && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          paddingTop: '0.5rem',
          borderTop: '1px dashed var(--border-color, #e2e8f0)',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          {/* Summary Strip for All Periods */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.5rem',
            padding: '0.65rem',
            backgroundColor: 'var(--bg-subtle, #f8fafc)',
            borderRadius: '8px',
            border: '1px solid var(--border-color, #e2e8f0)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)', display: 'block' }}>Morning Peak (15m)</span>
              <strong style={{ fontSize: '1rem', color: '#0284c7' }}>~{summary.morningPeakAvg} pax</strong>
              <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>05:00 - 09:00</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)', display: 'block' }}>Midday Off-Peak (30m)</span>
              <strong style={{ fontSize: '1rem', color: '#10b981' }}>~{summary.middayAvg} pax</strong>
              <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>09:00 - 16:00</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)', display: 'block' }}>Evening Peak (15m)</span>
              <strong style={{ fontSize: '1rem', color: '#f59e0b' }}>~{summary.eveningPeakAvg} pax</strong>
              <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>16:00 - 20:00</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #64748b)', display: 'block' }}>Night (15m)</span>
              <strong style={{ fontSize: '1rem', color: '#6366f1' }}>~{summary.nightAvg} pax</strong>
              <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>20:00 - 22:00</span>
            </div>
          </div>

          {/* Filter Chips & Time Search Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: `All (54)` },
                { id: 'morning', label: 'Morning (15m)' },
                { id: 'midday', label: 'Midday (30m)' },
                { id: 'evening', label: 'Evening (15m)' },
                { id: 'night', label: 'Night (15m)' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveFilter(f.id)}
                  style={{
                    padding: '0.25rem 0.6rem',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: activeFilter === f.id ? '1px solid var(--primary, #0284c7)' : '1px solid var(--border-color, #cbd5e1)',
                    backgroundColor: activeFilter === f.id ? 'var(--primary, #0284c7)' : 'transparent',
                    color: activeFilter === f.id ? '#ffffff' : 'var(--text-secondary, #334155)',
                    cursor: 'pointer'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <input
                type="text"
                placeholder="Search slot (e.g. 07:30)"
                value={searchTime}
                onChange={(e) => setSearchTime(e.target.value)}
                style={{
                  padding: '0.28rem 0.55rem',
                  fontSize: '0.76rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #cbd5e1)',
                  backgroundColor: 'var(--bg-input, #ffffff)',
                  color: 'var(--text-main, #0f172a)',
                  width: '150px'
                }}
              />
            </div>
          </div>

          {/* Time Slot Trend Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '0.5rem',
            maxHeight: '380px',
            overflowY: 'auto',
            paddingRight: '0.2rem'
          }}>
            {filteredSlots.map((slot) => {
              const isNow = activeSlot?.slotId === slot.slotId;
              return (
                <div
                  key={slot.slotId}
                  style={{
                    padding: '0.65rem 0.75rem',
                    borderRadius: '8px',
                    border: isNow ? '2px solid #0284c7' : '1px solid var(--border-color, #e2e8f0)',
                    backgroundColor: isNow ? 'rgba(2, 132, 199, 0.08)' : 'var(--bg-subtle, #f8fafc)',
                    boxShadow: isNow ? '0 0 8px rgba(2, 132, 199, 0.2)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.35rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main, #0f172a)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={12} color="var(--primary, #0284c7)" />
                      {slot.label}
                    </span>
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.35rem',
                      borderRadius: '4px',
                      backgroundColor: slot.duration === 15 ? 'rgba(59, 130, 246, 0.12)' : 'rgba(168, 85, 247, 0.12)',
                      color: slot.duration === 15 ? '#2563eb' : '#9333ea'
                    }}>
                      {slot.duration}m
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #64748b)' }}>Queue:</span>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: slot.crowdColor }}>
                        ~{slot.predictedQueue} pax
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontSize: '0.66rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        backgroundColor: getCrowdBg(slot.crowdLevel),
                        color: slot.crowdColor,
                        border: `1px solid ${getCrowdBorder(slot.crowdLevel)}`
                      }}>
                        {slot.crowdLevel}
                      </span>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted, #64748b)', marginTop: '0.15rem' }}>
                        ~{slot.avgQueuePerBus} / bus
                      </div>
                    </div>
                  </div>

                  {isNow && (
                    <div style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      color: '#0284c7',
                      textAlign: 'center',
                      paddingTop: '0.15rem',
                      borderTop: '1px dashed #bae6fd'
                    }}>
                      ● Active Window
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quick Collapse Button */}
          <button
            type="button"
            onClick={() => setShowTrends(false)}
            style={{
              padding: '0.45rem',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--text-muted, #64748b)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.3rem'
            }}
          >
            <ChevronUp size={14} /> Collapse trends (show current period only)
          </button>
        </div>
      )}
    </div>
  );
}
