import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { generatePDFSummaryReport, downloadTripSummaryCSV } from '../services/pdfReportGenerator';
import { fetchDailyTripSummary } from '../services/supabaseClient';

const timeframeStart = (timeframe) => {
  const start = new Date();
  if (timeframe === 'Week') start.setDate(start.getDate() - 7);
  else if (timeframe === 'Month') start.setMonth(start.getMonth() - 1);
  else if (timeframe === 'Year') start.setFullYear(start.getFullYear() - 1);
  else start.setHours(0, 0, 0, 0);
  return start.toISOString();
};

export function DailyTripSummaryPage() {
  const { dutySession } = useAuth();
  const [timeframe, setTimeframe] = useState('Day');
  const [summary, setSummary] = useState({ totals: { boarded: 0, alighted: 0, passengersBoarded: 0, passengersAlighted: 0 }, stops: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await fetchDailyTripSummary({ since: timeframeStart(timeframe), dutySession });
    if (result.success) setSummary(result.data);
    else setError(result.error);
    setLoading(false);
  }, [timeframe, dutySession]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const handleSync = () => {
      refresh();
    };
    window.addEventListener('qcbus_registry_sync', handleSync);
    window.addEventListener('storage', handleSync);
    window.addEventListener('focus', handleSync);
    return () => {
      window.removeEventListener('qcbus_registry_sync', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [refresh]);

  const handleDownloadPDF = () => generatePDFSummaryReport({ timeframe, dutySession, summary });
  const handleDownloadCSV = () => downloadTripSummaryCSV({ timeframe, dutySession, summary });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <section className="card">
        <h1 style={{ fontSize: '1.6rem', marginBottom: '.3rem' }}>Operations Trip Summary</h1>
        <p style={{ color: 'var(--text-muted)' }}>Passenger totals are calculated from recorded boarding and alighting scans.</p>
        <p style={{ color: 'var(--text-muted)' }}>Duty bus: {summary.plateNumber || dutySession?.plateNumber || 'Not assigned'} · Service date: {summary.serviceDate || dutySession?.serviceDate || 'Today'}</p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '.75rem' }}>
          <span><strong>Driver:</strong> {summary.driverName || 'Not assigned'}</span>
          <span><strong>Conductor:</strong> {summary.conductorName || 'Not assigned'}</span>
          <span><strong>Dispatcher:</strong> {summary.dispatcherName || 'Not assigned'}</span>
        </div>
      </section>

      <section className="card" style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
        <strong>Select timeframe:</strong>
        {['Day', 'Week', 'Month', 'Year'].map((value) => (
          <button key={value} type="button" className={`btn ${timeframe === value ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTimeframe(value)}>
            {value}
          </button>
        ))}
        <button type="button" className="btn btn-secondary" onClick={refresh}>
          Refresh
        </button>
      </section>

      {error && <div className="alert alert-danger">Could not load scan totals: {error}</div>}

      <section className="stats-grid">
        <div className="stat-card">
          <span>Passengers boarded ({timeframe})</span>
          <div className="stat-number">{loading ? '…' : summary.totals.passengersBoarded}</div>
        </div>
        <div className="stat-card">
          <span>Passengers alighted ({timeframe})</span>
          <div className="stat-number">{loading ? '…' : summary.totals.passengersAlighted}</div>
        </div>
      </section>

      <section className="card">
        <h2 style={{ fontSize: '1.15rem', marginBottom: '.75rem' }}>Passenger recorded per stop</h2>
        {summary.stops.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No passenger events were recorded for this period.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Stop</th>
                  <th>Boarded</th>
                  <th>Alighted</th>
                  <th>Onboard after stop</th>
                  <th>Last recorded</th>
                </tr>
              </thead>
              <tbody>
                {summary.stops.map((row) => (
                  <tr key={row.stopName}>
                    <td>{row.stopName}</td>
                    <td>{row.boarded}</td>
                    <td>{row.alighted}</td>
                    <td>{row.total}</td>
                    <td>{row.lastEventAt ? new Date(row.lastEventAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p style={{ color: 'var(--text-muted)', marginTop: '1rem', marginBottom: '1rem' }}>Totals include non-reversed records recorded in the database for the selected period.</p>
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleDownloadPDF} className="btn btn-primary">
            Download PDF Operations Report
          </button>
          <button type="button" onClick={handleDownloadCSV} className="btn btn-secondary">
            Download CSV Trip Summary
          </button>
        </div>
      </section>
    </div>
  );
}
