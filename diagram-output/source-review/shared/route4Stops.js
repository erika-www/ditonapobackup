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
  .map((stop, index) => ({
    ...stop,
    id: `sb-stop-${index + 1}`,
    stopNumber: index + 1,
    sequenceNumber: index + 1
  }));

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

  // 1. Direct normalized comparison against name, canonicalDbName, shortName
  const clean = rawStr.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const exact = ROUTE4_STOPS.find((s) => {
    const c1 = s.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const c2 = s.canonicalDbName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const c3 = (s.shortName || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return clean === c1 || clean === c2 || clean === c3;
  });
  if (exact) return exact;

  // 2. High-priority keyword and landmark mappings (tested against all variations)
  const lower = rawStr.toLowerCase();
  if (lower.includes('sb road') || lower.includes('sb terminal') || (lower.includes('general luis') && !lower.includes('bayan') && !lower.includes('banahaw')) || (lower.includes('gen. luis') && !lower.includes('bayan') && !lower.includes('banahaw'))) {
    return ROUTE4_STOPS[14]; // Stop 15: General Luis Avenue corner SB Road
  }
  if (lower.includes('banahaw')) return ROUTE4_STOPS[13]; // Stop 14: General Luis Avenue corner Banahaw Street
  if (lower.includes('bayan') || lower.includes('nova bayan')) return ROUTE4_STOPS[12]; // Stop 13: General Luis Avenue – Novaliches Bayan
  if (lower.includes('forest hills')) return ROUTE4_STOPS[11]; // Stop 12: Quirino Highway corner Forest Hills Drive
  if (lower.includes('sm novaliches') || lower.includes('sm city')) return ROUTE4_STOPS[10]; // Stop 11: Quirino Highway – SM City Novaliches
  if (lower.includes('qcu') || lower.includes('quezon city university') || lower.includes('novaliches district hospital') || lower.includes('ndh')) return ROUTE4_STOPS[9]; // Stop 10
  if (lower.includes('sauyo')) return ROUTE4_STOPS[7]; // Stop 8: Mindanao Avenue corner Old Sauyo Road
  if (lower.includes('munoz') || lower.includes('muñoz')) return ROUTE4_STOPS[6]; // Stop 7: Mindanao Avenue corner D. Muñoz Street
  if (lower.includes('tandang sora')) return ROUTE4_STOPS[5]; // Stop 6: Mindanao Avenue corner Tandang Sora Avenue
  if (lower.includes('congressional')) return ROUTE4_STOPS[4]; // Stop 5: Mindanao Avenue corner Congressional Avenue
  if (lower.includes('tullahan')) return ROUTE4_STOPS[3]; // Stop 4: Mindanao Avenue – Tullahan Bridge
  if (lower.includes('road 1') || lower.includes('rd 1') || lower.includes('rd. 1')) return ROUTE4_STOPS[2]; // Stop 3: Mindanao Avenue corner Road 1
  if (lower.includes('veterans') || lower.includes('vmmc') || lower.includes('vertis')) return ROUTE4_STOPS[1]; // Stop 2: North Avenue – Veterans Hospital / Vertis North
  if (lower.includes('qc hall') || lower.includes('quezon city hall') || lower.includes('nha') || lower.includes('elliptical')) return ROUTE4_STOPS[0]; // Stop 1: Quezon City Hall – NHA Interchange
  if (lower.includes('quirino') && lower.includes('mindanao')) return ROUTE4_STOPS[8]; // Stop 9: Mindanao Avenue corner Quirino Highway – Interchange

  // 3. Token Jaccard similarity fallback (comparing name and landmark)
  const inTokens = tokenizeStop(rawStr);
  if (inTokens.length > 0) {
    let best = null;
    let bestScore = 0;
    for (const s of ROUTE4_STOPS) {
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
  const resolved = resolveRoute4Stop(stopInput, direction);
  if (!resolved) return -1;
  const canonicalIndex = ROUTE4_STOPS.findIndex((s) => (
    s.id === resolved.id ||
    s.canonicalDbName === resolved.canonicalDbName ||
    s.name.toLowerCase() === resolved.name.toLowerCase()
  ));
  if (canonicalIndex === -1) return -1;
  const isSouth = String(direction).toLowerCase().includes('south');
  return isSouth ? (ROUTE4_STOPS.length - 1 - canonicalIndex) : canonicalIndex;
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
