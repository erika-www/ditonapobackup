// Route 4 official stop definitions matching Supabase stops table
export const ROUTE4_STOPS = [
  { id: 'stop-1', stopNumber: 1, sequenceNumber: 1, name: 'Quezon City Hall – NHA Interchange', shortName: 'Quezon City Hall NHA Interchange', canonicalDbName: 'Quezon City Hall – NHA Interchange', landmark: 'QC Hall Complex / Elliptical Road', lat: 14.650220638010133, lng: 121.05202242497576 },
  { id: 'stop-2', stopNumber: 2, sequenceNumber: 2, name: 'North Avenue – Veterans Hospital / Vertis North', shortName: 'North Ave. Veterans Hospital / Vertis North', canonicalDbName: 'North Avenue – Veterans Hospital / Vertis North', landmark: 'VMMC Hospital / Vertis North', lat: 14.653837872891756, lng: 121.03919441495735 },
  { id: 'stop-3', stopNumber: 3, sequenceNumber: 3, name: 'Mindanao Avenue corner Road 1', shortName: 'Mindanao Ave. cor. Road 1', canonicalDbName: 'Mindanao Avenue corner Road 1', landmark: 'Road 1 Junction', lat: 14.65565931812385, lng: 121.03557040362864 },
  { id: 'stop-4', stopNumber: 4, sequenceNumber: 4, name: 'Mindanao Avenue – Tullahan Bridge', shortName: 'Mindanao Ave. Tullahan Bridge', canonicalDbName: 'Mindanao Avenue – Tullahan Bridge', landmark: 'Tullahan Bridge / River Corridor', lat: 14.661252097669013, lng: 121.03681768535263 },
  { id: 'stop-5', stopNumber: 5, sequenceNumber: 5, name: 'Mindanao Avenue corner Congressional Avenue', shortName: 'Mindanao Ave. cor. Congressional Ave.', canonicalDbName: 'Mindanao Avenue corner Congressional Avenue', landmark: 'Congressional Ave Flyover', lat: 14.668691489622583, lng: 121.03358168194845 },
  { id: 'stop-6', stopNumber: 6, sequenceNumber: 6, name: 'Mindanao Avenue corner Tandang Sora Avenue', shortName: 'Mindanao Ave. cor. Tandang Sora Ave.', canonicalDbName: 'Mindanao Avenue corner Tandang Sora Avenue', landmark: 'Tandang Sora Junction', lat: 14.677454693786517, lng: 121.03221195651783 },
  { id: 'stop-7', stopNumber: 7, sequenceNumber: 7, name: 'Mindanao Avenue corner D. Muñoz Street', shortName: 'Mindanao Ave. cor. D. Muñoz St.', canonicalDbName: 'Mindanao Avenue corner D. Muñoz Street', landmark: 'D. Muñoz St. Landmark', lat: 14.681690588320933, lng: 121.03214549217034 },
  { id: 'stop-8', stopNumber: 8, sequenceNumber: 8, name: 'Mindanao Avenue corner Old Sauyo Road', shortName: 'Mindanao Ave. cor. Old Sauyo Rd.', canonicalDbName: 'Mindanao Avenue corner Old Sauyo Road', landmark: 'Sauyo Road Commercial Center', lat: 14.688344391235496, lng: 121.03095713022918 },
  { id: 'stop-9', stopNumber: 9, sequenceNumber: 9, name: 'Mindanao Avenue corner Quirino Highway – Interchange', shortName: 'Mindanao Ave. cor. Quirino Highway', canonicalDbName: 'Mindanao Avenue corner Quirino Highway – Interchange', landmark: 'Novaliches Junction Interchange', lat: 14.69038993558755, lng: 121.0283830873586 },
  { id: 'stop-10', stopNumber: 10, sequenceNumber: 10, name: 'Quezon City University Main Campus / Novaliches District Hospital', shortName: 'Quezon City University – Main Campus / Novaliches District Hospital', canonicalDbName: 'Quezon City University Main Campus / Novaliches District Hospital', landmark: 'QCU Main Campus / NDH Hospital', lat: 14.700148091475898, lng: 121.03464947084294 },
  { id: 'stop-11', stopNumber: 11, sequenceNumber: 11, name: 'Quirino Highway – SM City Novaliches', shortName: 'Quirino Highway / SM Novaliches', canonicalDbName: 'Quirino Highway – SM City Novaliches', landmark: 'SM City Novaliches', lat: 14.707175129320298, lng: 121.038840489371 },
  { id: 'stop-12', stopNumber: 12, sequenceNumber: 12, name: 'Quirino Highway corner Forest Hills Drive', shortName: 'Quirino Highway cor. Forest Hills Drive', canonicalDbName: 'Quirino Highway corner Forest Hills Drive', landmark: 'Forest Hills Drive Subd', lat: 14.716621284392273, lng: 121.04029019577789 },
  { id: 'stop-13', stopNumber: 13, sequenceNumber: 13, name: 'General Luis Avenue – Novaliches Bayan', shortName: 'Gen. Luis – Nova Bayan', canonicalDbName: 'General Luis Avenue – Novaliches Bayan', landmark: 'Novaliches Wet & Dry Market', lat: 14.721924560116276, lng: 121.03909751380627 },
  { id: 'stop-14', stopNumber: 14, sequenceNumber: 14, name: 'General Luis Avenue corner Banahaw Street', shortName: 'Gen. Luis cor. Banahaw St.', canonicalDbName: 'General Luis Avenue corner Banahaw Street', landmark: 'Banahaw St. Junction', lat: 14.720656149260963, lng: 121.02811208540082 },
  { id: 'stop-15', stopNumber: 15, sequenceNumber: 15, name: 'General Luis Avenue corner SB Road', shortName: 'Gen. Luis cor. SB Road', canonicalDbName: 'General Luis Avenue corner SB Road', landmark: 'General Luis SB Terminal', lat: 14.719769998791955, lng: 121.02128987815283 }
];

export const SOUTHBOUND_ROUTE4_STOPS = [...ROUTE4_STOPS]
  .reverse()
  .filter((stop) => {
    // Remove "Mindanao Avenue - Quirino Highway Interchange" for southbound
    const n = stop.name.toLowerCase();
    return !(n.includes('quirino') && n.includes('mindanao'));
  })
  .map((stop, index) => {
    const isNovaBayan = stop.name.toLowerCase().includes('bayan') || stop.name.toLowerCase().includes('nova');
    return {
      ...stop,
      id: `sb-stop-${index + 1}`,
      stopNumber: index + 1,
      sequenceNumber: index + 1,
      lat: isNovaBayan ? 14.721004296116766 : stop.lat,
      lng: isNovaBayan ? 121.03876650768528 : stop.lng
    };
  });

const COORDINATE_OVERRIDES_KEY = 'qcbus_route4_stop_coordinates';

export function applyRoute4CoordinateOverrides(stops, direction = 'Northbound') {
  if (typeof localStorage === 'undefined') return stops;
  try {
    const overrides = JSON.parse(localStorage.getItem(COORDINATE_OVERRIDES_KEY) || '{}');
    return stops.map((stop) => {
      const point = overrides[stop.id]?.[direction];
      return point ? { ...stop, lat: Number(point.lat), lng: Number(point.lng) } : stop;
    });
  } catch {
    return stops;
  }
}

export function saveRoute4CoordinateOverride(stopId, direction, lat, lng) {
  const overrides = JSON.parse(localStorage.getItem(COORDINATE_OVERRIDES_KEY) || '{}');
  overrides[stopId] = { ...(overrides[stopId] || {}), [direction]: { lat: Number(lat), lng: Number(lng) } };
  localStorage.setItem(COORDINATE_OVERRIDES_KEY, JSON.stringify(overrides));
}

function canonWord(w) {
  if (w === 'gen') return 'general';
  if (w === 'cor') return 'corner';
  if (w === 'ave') return 'avenue';
  if (w === 'rd') return 'road';
  if (w === 'st') return 'street';
  if (w === 'blvd') return 'boulevard';
  if (w === 'hwy') return 'highway';
  return w;
}

function tokenizeStop(s) {
  return String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim().split(' ')
    .map(canonWord)
    .filter((w) => w && !['the', 'and', 'cor', 'corner', 'ave', 'avenue', 'rd', 'road', 'st', 'street', 'hwy', 'highway'].includes(w));
}

/**
 * Universal stop resolver for Route 4.
 * Prioritizes stop names, landmarks, and keyword matches over arbitrary stop numbers.
 * Supports direction context ('Northbound' vs 'Southbound').
 */
export function resolveRoute4Stop(input, direction = null) {
  if (!input) return null;

  // 0. Object input extraction
  if (typeof input === 'object' && input !== null) {
    if (input.canonicalDbName) {
      const byDb = ROUTE4_STOPS.find((s) => s.canonicalDbName === input.canonicalDbName || s.name === input.canonicalDbName);
      if (byDb) return byDb;
    }
    const candidateName = input.name || input.shortName || input.stopName || input.origin_name || input.destination_name || input.title || '';
    if (candidateName) {
      const match = resolveRoute4Stop(candidateName, direction);
      if (match) return match;
    }
    if (input.id) {
      if (String(input.id).startsWith('sb-stop-')) {
        const num = Number.parseInt(input.id.replace('sb-stop-', ''), 10);
        if (num >= 1 && num <= SOUTHBOUND_ROUTE4_STOPS.length) {
          return SOUTHBOUND_ROUTE4_STOPS[num - 1];
        }
      }
      const matchedId = ROUTE4_STOPS.find((s) => s.id === input.id);
      if (matchedId) return matchedId;
    }
  }

  const rawStr = String(input || '').trim();
  if (!rawStr) return null;

  // If input has 'sb-stop-X'
  const sbIdMatch = rawStr.match(/^sb-stop-([0-9]{1,2})$/i);
  if (sbIdMatch) {
    const num = Number.parseInt(sbIdMatch[1], 10);
    if (num >= 1 && num <= SOUTHBOUND_ROUTE4_STOPS.length) {
      return SOUTHBOUND_ROUTE4_STOPS[num - 1];
    }
  }

  const isSouth = direction && String(direction).toLowerCase().includes('south');
  const pool = isSouth ? SOUTHBOUND_ROUTE4_STOPS : ROUTE4_STOPS;

  // 1. Direct normalized comparison against name, canonicalDbName, shortName
  const clean = rawStr.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const exact = pool.find((s) => {
    const c1 = s.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const c2 = s.canonicalDbName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const c3 = (s.shortName || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return clean === c1 || clean === c2 || clean === c3;
  });
  if (exact) return exact;

  // If exact match not in Southbound pool because it was an NB stop name, check if valid in Southbound
  if (isSouth) {
    const nbMatch = ROUTE4_STOPS.find((s) => {
      const c1 = s.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return clean === c1;
    });
    if (nbMatch) {
      const inSouthPool = pool.find((s) => s.name.toLowerCase() === nbMatch.name.toLowerCase());
      if (inSouthPool) return inSouthPool;
      if (nbMatch.name.toLowerCase().includes('quirino') && nbMatch.name.toLowerCase().includes('mindanao')) {
        return null; // Excluded in Southbound
      }
    }
  }

  // 2. High-priority keyword and landmark mappings (tested against all variations)
  const lower = rawStr.toLowerCase();
  const findInPool = (kw) => pool.find((s) => s.name.toLowerCase().includes(kw)) || null;

  if (lower.includes('sb road') || lower.includes('sb terminal') || (lower.includes('general luis') && !lower.includes('bayan') && !lower.includes('banahaw')) || (lower.includes('gen. luis') && !lower.includes('bayan') && !lower.includes('banahaw'))) {
    return findInPool('sb road') || pool[0];
  }
  if (lower.includes('banahaw')) return findInPool('banahaw') || pool[1];
  if (lower.includes('bayan') || lower.includes('nova bayan')) return findInPool('bayan') || pool[2];
  if (lower.includes('forest hills')) return findInPool('forest hills');
  if (lower.includes('sm novaliches') || lower.includes('sm city')) return findInPool('sm city');
  if (lower.includes('qcu') || lower.includes('quezon city university') || lower.includes('novaliches district hospital') || lower.includes('ndh')) return findInPool('university');
  if (lower.includes('sauyo')) return findInPool('sauyo');
  if (lower.includes('munoz') || lower.includes('muñoz')) return findInPool('muñoz') || findInPool('munoz');
  if (lower.includes('tandang sora')) return findInPool('tandang sora');
  if (lower.includes('congressional')) return findInPool('congressional');
  if (lower.includes('tullahan')) return findInPool('tullahan');
  if (lower.includes('road 1') || lower.includes('rd 1') || lower.includes('rd. 1')) return findInPool('road 1');
  if (lower.includes('veterans') || lower.includes('vmmc') || lower.includes('vertis')) return findInPool('veterans') || findInPool('vertis');
  if (lower.includes('qc hall') || lower.includes('quezon city hall') || lower.includes('nha') || lower.includes('elliptical')) return findInPool('quezon city hall') || pool[pool.length - 1];
  if (lower.includes('quirino') && lower.includes('mindanao')) {
    if (isSouth) return null; // Excluded on Southbound trip
    return ROUTE4_STOPS[8];
  }

  // 3. Token Jaccard similarity fallback (comparing name and landmark)
  const inTokens = tokenizeStop(rawStr);
  if (inTokens.length > 0) {
    let best = null;
    let bestScore = 0;
    for (const s of pool) {
      const sTokens = tokenizeStop(s.name);
      const matches = sTokens.filter((t) => inTokens.includes(t)).length;
      const union = new Set([...sTokens, ...inTokens]).size;
      const jaccard = matches / union;
      if (jaccard > bestScore) {
        bestScore = jaccard;
        best = s;
      }
    }
    if (bestScore >= 0.25) return best;
  }

  // 4. Standalone stop number ONLY IF no name match was found (e.g. '1', '15', 'Stop 1', 'Stop 15')
  const isStrictNumber = /^(?:stop\s*[-_:]?\s*)?([0-9]{1,2})$/i.test(rawStr);
  if (isStrictNumber) {
    const num = Number.parseInt(rawStr.replace(/[^0-9]/g, ''), 10);
    const isSouth = direction && String(direction).toLowerCase().includes('south');
    const pool = isSouth ? SOUTHBOUND_ROUTE4_STOPS : ROUTE4_STOPS;
    if (num >= 1 && num <= pool.length) {
      return pool[num - 1];
    }
  }

  return null;
}

/**
 * Returns 0-based stop index along Route 4 for a given direction.
 * In Northbound: 0 (QC Hall) to 14 (Gen. Luis SB Road).
 * In Southbound: 0 (Gen. Luis SB Road) to 14 (QC Hall).
 */
export function getStopIndex(stopInput, direction = 'Northbound') {
  const isSouth = String(direction).toLowerCase().includes('south');
  const pool = isSouth ? SOUTHBOUND_ROUTE4_STOPS : ROUTE4_STOPS;
  const resolved = resolveRoute4Stop(stopInput, direction);
  if (!resolved) return -1;
  return pool.findIndex((s) => (
    s.id === resolved.id ||
    s.canonicalDbName === resolved.canonicalDbName ||
    s.name.toLowerCase() === resolved.name.toLowerCase()
  ));
}

/**
 * Infers travel direction (Northbound vs Southbound) from boarding & destination stops.
 */
export function detectPassengerDirection(boardingStop, destinationStop) {
  const resolvedFrom = resolveRoute4Stop(boardingStop);
  const resolvedTo = resolveRoute4Stop(destinationStop);
  if (!resolvedFrom || !resolvedTo) return null;
  const fromIdx = ROUTE4_STOPS.findIndex((s) => s.id === resolvedFrom.id || s.name.toLowerCase() === resolvedFrom.name.toLowerCase());
  const toIdx = ROUTE4_STOPS.findIndex((s) => s.id === resolvedTo.id || s.name.toLowerCase() === resolvedTo.name.toLowerCase());
  if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return null;
  return fromIdx < toIdx ? 'Northbound' : 'Southbound';
}

/**
 * Validates whether a passenger's selected direction and stops match the bus's operating direction.
 * Returns { valid: true } or { valid: false, error: 'trip error: wrong way' }
 */
export function validateTripDirection(passengerDirection, boardingStop, destinationStop, busDirection = 'Northbound') {
  const normalizedBusDir = String(busDirection || 'Northbound').trim().toLowerCase().includes('south')
    ? 'southbound'
    : 'northbound';

  const resolvedOrigin = resolveRoute4Stop(boardingStop, normalizedBusDir);
  const resolvedDest = resolveRoute4Stop(destinationStop, normalizedBusDir);

  if (!resolvedOrigin || !resolvedDest) {
    return { valid: true }; // Allow through if stop is unlisted to not block operations
  }

  if (resolvedOrigin.canonicalDbName === resolvedDest.canonicalDbName || resolvedOrigin.name === resolvedDest.name) {
    return { valid: false, error: 'trip error: wrong way' };
  }

  // 1. If the pass specifies explicit direction, compare directly with bus direction
  const explicitDir = passengerDirection
    ? (String(passengerDirection).trim().toLowerCase().includes('south')
        ? 'southbound'
        : (String(passengerDirection).trim().toLowerCase().includes('north') ? 'northbound' : null))
    : null;

  if (explicitDir && explicitDir !== normalizedBusDir) {
    return { valid: false, error: 'trip error: wrong way' };
  }

  // 2. Infer direction from canonical stop sequence
  const inferredDir = detectPassengerDirection(boardingStop, destinationStop);
  if (inferredDir && inferredDir.toLowerCase() !== normalizedBusDir) {
    return { valid: false, error: 'trip error: wrong way' };
  }

  // 3. Ensure destination is after origin in current bus sequence
  const fromIdx = getStopIndex(boardingStop, normalizedBusDir);
  const toIdx = getStopIndex(destinationStop, normalizedBusDir);
  if (fromIdx !== -1 && toIdx !== -1 && fromIdx >= toIdx) {
    return { valid: false, error: 'trip error: wrong way' };
  }

  return { valid: true };
}

/**
 * Haversine formula to compute distance in meters between two GPS coordinates.
 */
export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const p1 = Number(lat1);
  const l1 = Number(lon1);
  const p2 = Number(lat2);
  const l2 = Number(lon2);
  if (![p1, l1, p2, l2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const R = 6371000; // Earth radius in meters
  const dLat = ((p2 - p1) * Math.PI) / 180;
  const dLon = ((l2 - l1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1 * Math.PI) / 180) *
      Math.cos((p2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Resolves destination stop data and coordinates from Route 4 stop definitions
 * (incorporating direction context and any calibrated overrides).
 *
 * @param {string|object} destinationInput - Stop name, id, canonicalDbName, or stop object
 * @param {string} [direction='Northbound'] - 'Northbound' or 'Southbound'
 * @returns {object|null} The resolved Route 4 stop with verified lat & lng
 */
export function getRoute4DestinationStop(destinationInput, direction = 'Northbound') {
  if (!destinationInput) return null;
  const isSouth = direction && String(direction).toLowerCase().includes('south');
  const normDir = isSouth ? 'Southbound' : 'Northbound';

  const resolved = resolveRoute4Stop(destinationInput, normDir);
  const pool = isSouth ? SOUTHBOUND_ROUTE4_STOPS : ROUTE4_STOPS;
  const withOverrides = applyRoute4CoordinateOverrides(pool, normDir);

  if (resolved) {
    const overridden = withOverrides.find((s) => s.id === resolved.id || s.name === resolved.name);
    return overridden || resolved;
  }

  // Fallback for object with explicit coordinates
  if (typeof destinationInput === 'object' && destinationInput !== null) {
    const lat = Number(destinationInput.lat ?? destinationInput.latitude);
    const lng = Number(destinationInput.lng ?? destinationInput.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return {
        ...destinationInput,
        lat,
        lng,
        name: destinationInput.name || destinationInput.canonicalDbName || 'Destination'
      };
    }
  }

  return null;
}

/**
 * Checks if a given coordinate (such as the user's current latitude & longitude)
 * has reached their destination by comparing against the Route 4 stop data.
 *
 * @param {number} currentLat - User's current latitude
 * @param {number} currentLng - User's current longitude
 * @param {string|object} destinationInput - Destination stop name, ID, or object
 * @param {string} [direction='Northbound'] - Travel direction
 * @param {number} [thresholdMeters=50] - Arrival proximity threshold in meters (default 50m)
 * @returns {{
 *   reached: boolean,
 *   distanceMeters: number,
 *   distanceKm: number,
 *   destinationStop: object|null,
 *   thresholdMeters: number
 * }}
 */
export function checkDestinationReached(
  currentLat,
  currentLng,
  destinationInput,
  direction = 'Northbound',
  thresholdMeters = 50
) {
  const lat = Number(currentLat);
  const lng = Number(currentLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return {
      reached: false,
      distanceMeters: Number.POSITIVE_INFINITY,
      distanceKm: Number.POSITIVE_INFINITY,
      destinationStop: null,
      thresholdMeters
    };
  }

  const destStop = getRoute4DestinationStop(destinationInput, direction);
  if (!destStop || !Number.isFinite(Number(destStop.lat)) || !Number.isFinite(Number(destStop.lng))) {
    return {
      reached: false,
      distanceMeters: Number.POSITIVE_INFINITY,
      distanceKm: Number.POSITIVE_INFINITY,
      destinationStop: null,
      thresholdMeters
    };
  }

  const distanceMeters = haversineDistanceMeters(lat, lng, Number(destStop.lat), Number(destStop.lng));
  const distanceKm = distanceMeters / 1000;
  const reached = distanceMeters <= thresholdMeters;

  return {
    reached,
    distanceMeters: Math.round(distanceMeters * 10) / 10,
    distanceKm: Math.round(distanceKm * 100) / 100,
    destinationStop: destStop,
    thresholdMeters
  };
}

