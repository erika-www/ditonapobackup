import React from 'react';
import { ExternalLink, Phone, Mail, MapPin } from 'lucide-react';

export function Footer() {
  return (
    <footer style={{
      backgroundColor: 'var(--bg-card)',
      borderTop: '1px solid var(--border-color)',
      padding: '2.5rem 1.5rem 1.5rem 1.5rem',
      marginTop: '3rem',
      color: 'var(--text-secondary)',
      fontSize: '0.85rem'
    }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Contact & Support Info Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '2rem',
          textAlign: 'left'
        }}>
          {/* Column 1: TTMD Contact Details */}
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.75rem', fontFamily: 'var(--font-heading)' }}>
              Traffic and Transport Management Department (TTMD)
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
              Quezon City Government Hall Complex, Elliptical Road, Diliman, Quezon City
            </p>
            <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div><strong>Email:</strong> <a href="mailto:ttmd@quezoncity.gov.ph" style={{ color: 'var(--primary)' }}>ttmd@quezoncity.gov.ph</a></div>
              <div><strong>Telephone:</strong> <a href="tel:87038906" style={{ color: 'var(--primary)' }}>8703-8906</a></div>
              <div><strong>City Hotline:</strong> <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>QC:122</span></div>
            </div>
          </div>

          {/* Column 2: Official References & Links */}
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.75rem', fontFamily: 'var(--font-heading)' }}>
              Official References & Resources
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <li>
                <a href="https://quezoncity.gov.ph/qcitizen-guides/quezon-city-bus-service-program/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  QC Bus Service Program Guide <ExternalLink size={12} />
                </a>
              </li>
              <li>
                <a href="https://quezoncity.gov.ph/program/qcitizen-id/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  QCitizen ID Registration <ExternalLink size={12} />
                </a>
              </li>
              <li>
                <a href="https://quezoncity.gov.ph/departments/tf-transport-and-traffic-management/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                  Traffic & Transport Management Dept <ExternalLink size={12} />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright Bar */}
        <div style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: '1.25rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.8rem'
        }}>
          <p style={{ fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>DITO NA PO: AI-Based QC Bus Route 4 Navigation System</p>
          <p style={{ fontSize: '0.78rem', margin: '0.25rem 0 0 0' }}>
            © 2026 BSCPE 4201. Free public transport service navigation for all commuters.
          </p>
        </div>
      </div>
    </footer>
  );
}
