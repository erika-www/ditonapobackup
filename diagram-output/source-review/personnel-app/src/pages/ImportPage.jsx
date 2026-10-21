/**
 * ImportPage Component (React / JSX)
 * Administrative portal page for uploading CSV/JSON datasets with dry-run schema validation.
 */
import React, { useState } from 'react';
import { previewImport, commitImport } from '../services/api';
import { Upload, CheckCircle2, AlertTriangle, Database } from 'lucide-react';

export function ImportPage() {
  const [entityType, setEntityType] = useState('routes');
  const [file, setFile] = useState(null);

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);

  const [commitResult, setCommitResult] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setPreview(null);
      setCommitResult(null);
      setError(null);
    }
  };

  const handleRunPreview = async () => {
    if (!file) return;
    try {
      setLoading(true);
      setError(null);
      setCommitResult(null);
      const res = await previewImport(entityType, file);
      setPreview(res);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to analyze import file.');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteCommit = async () => {
    if (!preview || preview.preview_data.length === 0) return;
    try {
      setCommitting(true);
      setError(null);
      const res = await commitImport(preview.entity_type, preview.preview_data);
      setCommitResult({ status: res.status, message: res.message });
      setPreview(null);
      setFile(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Dataset commit failed.');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Dataset Importer & Validator</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Import future QC Bus datasets (CSV/JSON) with dry-run schema validation report.
          </p>
        </div>
      </div>

      {commitResult && (
        <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <CheckCircle2 size={20} /> {commitResult.message}
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <AlertTriangle size={20} /> {error}
        </div>
      )}

      {/* Upload Dropzone */}
      <div className="stat-card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>Step 1: Upload Dataset & Select Entity</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
          <div>
            <div className="form-group">
              <label className="form-label">Target Master Entity</label>
              <select
                className="form-select"
                value={entityType}
                onChange={(e) => { setEntityType(e.target.value); setPreview(null); }}
              >
                <option value="routes">Routes Dataset (route_code, route_name, description)</option>
                <option value="stops">Bus Stops Dataset (stop_code, stop_name, address, latitude, longitude)</option>
              </select>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '1rem', background: 'var(--bg-subtle)', padding: '0.85rem', borderRadius: 'var(--radius-sm)' }}>
              <strong>Import Safety Protocol:</strong> All uploads execute a dry-run preview first. Rows with duplicate primary keys or invalid column data are reported before committing to PostgreSQL.
            </div>
          </div>

          <div>
            <label className="dropzone" style={{ display: 'block' }}>
              <input type="file" accept=".csv,.json" onChange={handleFileChange} style={{ display: 'none' }} />
              <Upload size={36} color="#06b6d4" style={{ margin: '0 auto 0.75rem' }} />
              <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f8fafc' }}>
                {file ? file.name : 'Click to select or drag CSV / JSON file'}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Supports .csv and .json files'}
              </div>
            </label>

            {file && !preview && (
              <button
                type="button"
                onClick={handleRunPreview}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '1rem', justifyContent: 'center', padding: '0.75rem' }}
                disabled={loading}
              >
                {loading ? 'Analyzing & Validating Rows...' : 'Run Dry-Run Validation Preview'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Validation Preview Report */}
      {preview && (
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Step 2: Validation Preview Report</h2>

            <button
              type="button"
              onClick={handleExecuteCommit}
              className="btn btn-primary"
              disabled={committing || preview.invalid_rows_count > 0}
              style={{ background: preview.invalid_rows_count > 0 ? '#64748b' : 'var(--color-emerald)' }}
            >
              <Database size={16} /> {committing ? 'Committing Data...' : `Commit ${preview.valid_rows_count} Rows to PostgreSQL`}
            </button>
          </div>

          {/* Metrics summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Total Analyzed Rows</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{preview.total_rows}</div>
            </div>

            <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <div style={{ color: '#34d399', fontSize: '0.85rem', fontWeight: 600 }}>Valid Rows (Ready)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399' }}>{preview.valid_rows_count}</div>
            </div>

            <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
              <div style={{ color: '#f87171', fontSize: '0.85rem', fontWeight: 600 }}>Invalid Rows (Errors)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f87171' }}>{preview.invalid_rows_count}</div>
            </div>
          </div>

          {/* Validation Errors Table */}
          {preview.errors.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', color: '#f87171', fontWeight: 700, marginBottom: '0.5rem' }}>
                Validation Error Breakdown ({preview.errors.length})
              </h3>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Row #</th>
                      <th>Target Field</th>
                      <th>Error Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.errors.map((err, idx) => (
                      <tr key={idx}>
                        <td>#{err.row_number}</td>
                        <td style={{ color: '#f87171', fontWeight: 600 }}>{err.field}</td>
                        <td>{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Valid Prospective Data Preview */}
          {preview.preview_data.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1rem', color: '#34d399', fontWeight: 700, marginBottom: '0.5rem' }}>
                Valid Prospective Rows Preview
              </h3>
              <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {Object.keys(preview.preview_data[0]).map((key) => (
                        <th key={key}>{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview_data.map((row, idx) => (
                      <tr key={idx}>
                        {Object.values(row).map((val, vIdx) => (
                          <td key={vIdx}>{val !== null ? String(val) : '-'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
