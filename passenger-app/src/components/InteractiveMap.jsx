/**
 * InteractiveMap Component (React / JSX)
 * Leaflet-powered interactive map with real-time GPS Geolocation,
 * Route 4 corridor polyline matching the official QC Bus network reference,
 * numbered stop badges (1 - 15), and live bus tracking.
 */
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapPin, Navigation, Compass, Plus, CheckCircle, Crosshair, Map as MapIcon, WifiOff } from 'lucide-react';
import { findNearestStop, formatDistance, estimateWalkingTimeMins } from '../utils/geoUtils';
import { QC_ROUTES } from '../mockData';
import { ROUTE4_STOPS } from '@shared/route4Stops';
import { fetchConfiguredRoute4Stops } from '../services/supabaseClient';

export function InteractiveMap({ onSelectStartStop, onShowToast, liveBusCoords, liveBusPlate, isSignalLost, lastUpdatedSecondsAgo }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);

  // Default initial position (Quezon City Hall Interchange)
  const defaultUserPos = { lat: 14.65022, lng: 121.05202 };

  const [userLocation, setUserLocation] = useState(defaultUserPos);
  const [isLocating, setIsLocating] = useState(false);
  const [stopsList, setStopsList] = useState(ROUTE4_STOPS.map((s, idx) => ({ ...s, stopNumber: idx + 1, routeCode: 'R4', routeName: 'Route 4: QC Hall to General Luis' })));
  const [nearestStopInfo, setNearestStopInfo] = useState(null);

  // Custom GPS Feeding Form State
  const [customLat, setCustomLat] = useState('14.65022');
  const [customLng, setCustomLng] = useState('121.05202');
  const [customStopName, setCustomStopName] = useState('');
  const [showFeedModal, setShowFeedModal] = useState(false);

  // Load Route 4 stops
  useEffect(() => {
    let mounted = true;
    const route4 = QC_ROUTES.find((r) => r.id === 'route-4') || QC_ROUTES[0];
    const loadStops = async () => {
      const result = await fetchConfiguredRoute4Stops();
      if (!mounted) return;
      const sourceStops = (result.success && result.data.length) ? result.data : ROUTE4_STOPS;
      const seenNames = new Set();
      const uniqueStops = [];
      for (const st of sourceStops) {
        const norm = String(st.name || '').trim().toLowerCase();
        if (!seenNames.has(norm)) {
          seenNames.add(norm);
          uniqueStops.push(st);
        }
      }
      setStopsList(uniqueStops.slice(0, 15).map((stop, idx) => ({
        ...stop,
        stopNumber: idx + 1,
        sequenceNumber: idx + 1,
        routeCode: 'R4',
        routeName: route4.name,
        routeColor: '#8b5cf6'
      })));
    };
    loadStops();
    return () => { mounted = false; };
  }, []);

  // Recalculate nearest stop whenever userLocation or stopsList changes
  useEffect(() => {
    if (userLocation && stopsList.length > 0) {
      const nearest = findNearestStop(userLocation.lat, userLocation.lng, stopsList);
      setNearestStopInfo(nearest);
    }
  }, [userLocation, stopsList]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current).setView([14.685, 121.035], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | QC Bus Augmentation',
        maxZoom: 19,
      }).addTo(map);

      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        setUserLocation({ lat, lng });
        setCustomLat(lat.toFixed(5));
        setCustomLng(lng.toFixed(5));
        if (onShowToast) {
          onShowToast(`GPS Position set to: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
      });

      markersGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;

      // Fit bounds to cover all 15 stops of Route 4
      if (stopsList.length > 0) {
        const bounds = L.latLngBounds(stopsList.map(s => [s.lat, s.lng]));
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update map markers and route polyline whenever location, stops, or live bus coords change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = markersGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // 0. Highlighted Bus Route Polyline stretching from General Luis SB Road to QC Hall (matching network graphic)
    const ROUTE4_PATH_COORDINATES = [
      [14.719769998791955, 121.02128987815283], // Stop 15: General Luis Ave cor SB Road
      [14.720656149260963, 121.02811208540082], // Stop 14: General Luis Ave cor Banahaw St
      [14.721400, 121.033500],                   // General Luis Ave
      [14.721924560116276, 121.03909751380627], // Stop 13: General Luis Ave – Nova Bayan
      [14.720500, 121.039900],                   // Turn south into Quirino Highway
      [14.716621284392273, 121.04029019577789], // Stop 12: Quirino Hwy cor Forest Hills Dr
      [14.707175129320298, 121.03884048937100], // Stop 11: Quirino Hwy – SM City Novaliches
      [14.703500, 121.036800],                   // Quirino Hwy
      [14.700148091475898, 121.03464947084294], // Stop 10: QCU Main Campus / NDH Hospital
      [14.690389935587550, 121.02838308735860], // Stop 9: Mindanao Ave cor Quirino Hwy Interchange
      [14.688344391235496, 121.03095713022918], // Stop 8: Mindanao Ave cor Old Sauyo Rd
      [14.681690588320933, 121.03214549217034], // Stop 7: Mindanao Ave cor D. Muñoz St
      [14.677454693786517, 121.03221195651783], // Stop 6: Mindanao Ave cor Tandang Sora Ave
      [14.668691489622583, 121.03358168194845], // Stop 5: Mindanao Ave cor Congressional Ave
      [14.661252097669013, 121.03681768535263], // Stop 4: Mindanao Ave – Tullahan Bridge
      [14.655659318123850, 121.03557040362864], // Stop 3: Mindanao Ave cor Road 1
      [14.654800, 121.036500],                   // Mindanao Ave onto North Ave
      [14.653837872891756, 121.03919441495735], // Stop 2: North Ave – Veterans Hospital / Vertis North
      [14.653000, 121.043500],                   // North Ave towards EDSA
      [14.651500, 121.048500],                   // Elliptical Road approach
      [14.650220638010133, 121.05202242497576]  // Stop 1: Quezon City Hall – NHA Interchange
    ];

    // Glow underlay
    L.polyline(ROUTE4_PATH_COORDINATES, {
      color: '#8b5cf6',
      weight: 12,
      opacity: 0.35,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(layerGroup);

    // Main vibrant corridor line
    const routeLine = L.polyline(ROUTE4_PATH_COORDINATES, {
      color: '#7c3aed',
      weight: 6,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(layerGroup);

    // Inner highlight core
    L.polyline(ROUTE4_PATH_COORDINATES, {
      color: '#c084fc',
      weight: 2,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(layerGroup);

    routeLine.bindPopup(`
      <div style="font-family: sans-serif; font-size: 13px; color: #0f172a;">
        <strong style="color: #7c3aed;">🚌 Route 4 Corridor</strong><br/>
        General Luis (SB Road) ↔ Quezon City Hall<br/>
        <span style="color: #16a34a; font-size: 11px; font-weight: 700;">15 Stops Connected</span>
      </div>
    `);

    // 1. User Position Marker
    const userIcon = L.divIcon({
      className: 'custom-user-marker',
      html: `
        <div style="
          width: 20px;
          height: 20px;
          background: #0284c7;
          border: 3px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 12px rgba(2, 132, 199, 0.9);
        "></div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(layerGroup);
    userMarker.bindPopup(`
      <div style="font-family: sans-serif; font-size: 13px; color: #0f172a;">
        <strong style="color: #0284c7;">📍 Your Location</strong><br/>
        Lat: ${userLocation.lat.toFixed(4)}, Lng: ${userLocation.lng.toFixed(4)}
      </div>
    `);

    // 2. Real-time Live Bus Marker
    if (liveBusCoords) {
      const busPos = liveBusCoords;
      const busIconColor = isSignalLost ? '#ef4444' : '#10b981';

      const liveBusIcon = L.divIcon({
        className: 'custom-bus-marker',
        html: `
          <span class="live-bus-position" style="--bus-position-color: ${busIconColor}">
            <span class="live-bus-position-pulse"></span>
            <span class="live-bus-position-dot"></span>
          </span>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const busMarker = L.marker([busPos.lat, busPos.lng], { icon: liveBusIcon }).addTo(layerGroup);
      busMarker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 13px; color: #0f172a;">
          <strong style="color: ${busIconColor};">🚌 ${liveBusPlate || 'QC Bus Route 4'}</strong><br/>
          ${isSignalLost ? '<span style="color: #ef4444; font-weight: 700;">⚠️ Stale GPS</span>' : '<span style="color: #10b981; font-weight: 700;">🟢 Live Signal Active</span>'}<br/>
          Speed: ${Number.isFinite(busPos.speed) ? busPos.speed.toFixed(1) + ' km/h' : 'In Service'}<br/>
          Updated: ${lastUpdatedSecondsAgo !== undefined ? lastUpdatedSecondsAgo + 's ago' : 'Just now'}
        </div>
      `);
    }

    // 3. Numbered Stop Markers strictly (1 to 15)
    stopsList.slice(0, 15).forEach((stop, index) => {
      const stopNum = index + 1;
      const isNearest = nearestStopInfo && nearestStopInfo.stop.id === stop.id;
      const isFirst = stopNum === 1;
      const isInterchange = stopNum === 9;
      const isLast = stopNum === 15;

      // Color coding inspired by attached reference map
      const badgeBg = isFirst ? '#dc2626' : isLast ? '#7c3aed' : isInterchange ? '#f59e0b' : isNearest ? '#10b981' : '#6d28d9';
      const badgeSize = isFirst || isLast || isInterchange ? '30px' : isNearest ? '28px' : '24px';

      const stopIcon = L.divIcon({
        className: 'custom-stop-marker',
        html: `
          <div style="
            width: ${badgeSize};
            height: ${badgeSize};
            background: ${badgeBg};
            border: 2px solid #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: ${stopNum >= 10 ? '10px' : '12px'};
            font-weight: 800;
            box-shadow: 0 2px 8px rgba(0,0,0,0.45);
          ">
            ${stopNum}
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker([stop.lat, stop.lng], { icon: stopIcon }).addTo(layerGroup);
      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 13px; color: #0f172a; min-width: 200px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="background: ${badgeBg}; color: white; padding: 2px 7px; border-radius: 12px; font-weight: 800; font-size: 11px;">
              Stop ${stopNum} of 15
            </span>
            ${isFirst ? '<span style="color: #dc2626; font-weight: 700; font-size: 11px;">Origin Terminal</span>' : ''}
            ${isLast ? '<span style="color: #7c3aed; font-weight: 700; font-size: 11px;">End Terminal</span>' : ''}
            ${isInterchange ? '<span style="color: #f59e0b; font-weight: 700; font-size: 11px;">Major Interchange</span>' : ''}
          </div>
          <strong style="color: #0f172a; font-size: 13px; display: block; margin-bottom: 2px;">${stop.name}</strong>
          <span style="font-size: 11px; color: #64748b;">Route 4: QC Hall ↔ General Luis</span>
          <div style="margin-top: 8px;">
            <button
              id="set-boarding-stop-${stopNum}"
              type="button"
              style="
                background: #0284c7;
                color: #fff;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 11px;
                cursor: pointer;
                font-weight: 600;
              "
            >
              Set as Boarding Stop
            </button>
          </div>
        </div>
      `);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`set-boarding-stop-${stopNum}`);
        if (btn) {
          btn.onclick = () => {
            if (onSelectStartStop) onSelectStartStop(stop);
            if (onShowToast) onShowToast(`Selected Stop #${stopNum}: ${stop.name} as boarding location.`);
          };
        }
      });
    });
  }, [userLocation, stopsList, nearestStopInfo, liveBusCoords, liveBusPlate, isSignalLost, lastUpdatedSecondsAgo]);

  const handleLocateMe = () => {
    setIsLocating(true);
    if (onShowToast) onShowToast('Acquiring high-accuracy GPS coordinates...');

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserLocation({ lat, lng });
          setCustomLat(lat.toFixed(5));
          setCustomLng(lng.toFixed(5));
          setIsLocating(false);

          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([lat, lng], 14);
          }
          if (onShowToast) onShowToast('Your device location was successfully detected!');
        },
        (err) => {
          console.warn('Geolocation error:', err);
          setIsLocating(false);
          if (onShowToast) onShowToast('Using default Quezon City Hall location.');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      setIsLocating(false);
    }
  };

  const handleApplyCustomGPS = (e) => {
    e.preventDefault();
    const parsedLat = parseFloat(customLat);
    const parsedLng = parseFloat(customLng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      if (onShowToast) onShowToast('Invalid coordinates entered.');
      return;
    }

    setUserLocation({ lat: parsedLat, lng: parsedLng });
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([parsedLat, parsedLng], 14);
    }
    setShowFeedModal(false);
    if (onShowToast) onShowToast(`Custom GPS set to: ${parsedLat.toFixed(4)}, ${parsedLng.toFixed(4)}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {/* Top Map Control Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        backgroundColor: 'var(--bg-subtle)',
        padding: '0.75rem 1rem',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MapIcon size={18} color="var(--primary)" />
          <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>
            Route 4 Live Corridor Map (15 Stops)
          </span>
          <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '12px', background: '#7c3aed', color: '#fff', fontWeight: 700 }}>
            Active
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocating}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Compass size={14} className={isLocating ? 'spin-icon' : ''} />
            {isLocating ? 'Locating...' : 'Locate Me'}
          </button>
          <button
            type="button"
            onClick={() => setShowFeedModal(!showFeedModal)}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Crosshair size={14} /> Feed GPS
          </button>
        </div>
      </div>

      {/* Nearest Stop Smart Advisory Box */}
      {nearestStopInfo && (
        <div style={{
          backgroundColor: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.85rem'
            }}>
              {nearestStopInfo.stop.stopNumber || '✓'}
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Nearest Bus Stop Detected
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                Stop {nearestStopInfo.stop.stopNumber || ''}: {nearestStopInfo.stop.name}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {formatDistance(nearestStopInfo.distanceKm)} away · ~{estimateWalkingTimeMins(nearestStopInfo.distanceKm)} min walk
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onSelectStartStop) onSelectStartStop(nearestStopInfo.stop);
              if (onShowToast) onShowToast(`Selected ${nearestStopInfo.stop.name} as boarding location!`);
            }}
            className="btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem' }}
          >
            Set as Boarding Stop
          </button>
        </div>
      )}

      {/* Manual GPS Feeding Drawer */}
      {showFeedModal && (
        <form onSubmit={handleApplyCustomGPS} style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          alignItems: 'flex-end'
        }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Latitude</label>
            <input
              type="text"
              className="form-input"
              value={customLat}
              onChange={(e) => setCustomLat(e.target.value)}
              placeholder="14.65022"
              required
            />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Longitude</label>
            <input
              type="text"
              className="form-input"
              value={customLng}
              onChange={(e) => setCustomLng(e.target.value)}
              placeholder="121.05202"
              required
            />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Quick Preset Stop</label>
            <select
              className="form-select"
              onChange={(e) => {
                const s = stopsList.find(st => st.id === e.target.value);
                if (s) {
                  setCustomLat(s.lat.toFixed(5));
                  setCustomLng(s.lng.toFixed(5));
                  setCustomStopName(s.name);
                }
              }}
            >
              <option value="">Choose a Route 4 Stop...</option>
              {stopsList.map((s, idx) => (
                <option key={s.id} value={s.id}>{idx + 1}. {s.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary" style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}>
            Apply Position
          </button>
        </form>
      )}

      {/* Leaflet Map Canvas */}
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '460px',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-md)',
          zIndex: 1
        }}
      />

    </div>
  );
}
