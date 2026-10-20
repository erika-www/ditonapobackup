// Route 4 northbound stop order and GPS coordinates used by both apps.
export const ROUTE4_STOPS = [
  { id: 'stop-1', stopNumber: 1, sequenceNumber: 1, name: 'Quezon City Hall NHA Interchange', landmark: 'QC Hall Complex / Elliptical Road', lat: 14.650220638010133, lng: 121.05202242497576 },
  { id: 'stop-2', stopNumber: 2, sequenceNumber: 2, name: 'North Ave. Veterans Hospital / Vertis North', landmark: 'VMMC Hospital / Vertis North', lat: 14.653837872891756, lng: 121.03919441495735 },
  { id: 'stop-3', stopNumber: 3, sequenceNumber: 3, name: 'Mindanao Ave. cor. Road 1', landmark: 'Road 1 Junction', lat: 14.65565931812385, lng: 121.03557040362864 },
  { id: 'stop-4', stopNumber: 4, sequenceNumber: 4, name: 'Mindanao Ave. Tullahan Bridge', landmark: 'Tullahan Bridge / River Corridor', lat: 14.661252097669013, lng: 121.03681768535263 },
  { id: 'stop-5', stopNumber: 5, sequenceNumber: 5, name: 'Mindanao Ave. cor. Congressional Ave.', landmark: 'Congressional Ave Flyover', lat: 14.668691489622583, lng: 121.03358168194845 },
  { id: 'stop-6', stopNumber: 6, sequenceNumber: 6, name: 'Mindanao Ave. cor. Tandang Sora Ave.', landmark: 'Tandang Sora Junction', lat: 14.677454693786517, lng: 121.03221195651783 },
  { id: 'stop-7', stopNumber: 7, sequenceNumber: 7, name: 'Mindanao Ave. cor. D. Muñoz St.', landmark: 'D. Muñoz St. Landmark', lat: 14.681690588320933, lng: 121.03214549217034 },
  { id: 'stop-8', stopNumber: 8, sequenceNumber: 8, name: 'Mindanao Ave. cor. Old Sauyo Rd.', landmark: 'Sauyo Road Commercial Center', lat: 14.688344391235496, lng: 121.03095713022918 },
  { id: 'stop-9', stopNumber: 9, sequenceNumber: 9, name: 'Mindanao Ave. cor. Quirino Highway', landmark: 'Novaliches Junction Interchange', lat: 14.69038993558755, lng: 121.0283830873586 },
  { id: 'stop-10', stopNumber: 10, sequenceNumber: 10, name: 'Quezon City University – Main Campus / Novaliches District Hospital', landmark: 'QCU Main Campus / NDH Hospital', lat: 14.700148091475898, lng: 121.03464947084294 },
  { id: 'stop-11', stopNumber: 11, sequenceNumber: 11, name: 'Quirino Highway / SM Novaliches', landmark: 'SM City Novaliches', lat: 14.707175129320298, lng: 121.038840489371 },
  { id: 'stop-12', stopNumber: 12, sequenceNumber: 12, name: 'Quirino Highway cor. Forest Hills Drive', landmark: 'Forest Hills Drive Subd', lat: 14.716621284392273, lng: 121.04029019577789 },
  { id: 'stop-13', stopNumber: 13, sequenceNumber: 13, name: 'Gen. Luis – Nova Bayan', landmark: 'Novaliches Wet & Dry Market', lat: 14.721924560116276, lng: 121.03909751380627 },
  { id: 'stop-14', stopNumber: 14, sequenceNumber: 14, name: 'Gen. Luis cor. Banahaw St.', landmark: 'Banahaw St. Junction', lat: 14.720656149260963, lng: 121.02811208540082 },
  { id: 'stop-15', stopNumber: 15, sequenceNumber: 15, name: 'Gen. Luis cor. SB Road', landmark: 'General Luis SB Terminal', lat: 14.719769998791955, lng: 121.02128987815283 }
];

export const SOUTHBOUND_ROUTE4_STOPS = [...ROUTE4_STOPS]
  .reverse()
  .map((stop, index) => ({ ...stop, stopNumber: index + 1, sequenceNumber: index + 1 }));

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
 * Universal stop resolver for Route 4:
 * Matches stop by stop number ('Stop 1', 1), exact name, landmark, or token overlap.
 */
export function resolveRoute4Stop(input) {
  if (!input) return null;
  if (typeof input === 'object' && input !== null) {
    const candidateName = input.name || input.stopName || input.origin_name || input.destination_name || input.title || '';
    if (candidateName) {
      const match = resolveRoute4Stop(candidateName);
      if (match) return match;
    }
    if (input.id) {
      const matchedId = ROUTE4_STOPS.find((s) => s.id === input.id);
      if (matchedId) return matchedId;
    }
  }

  const rawStr = String(input || '').trim();
  if (!rawStr) return null;

  // 1. Direct number or 'Stop X' match (e.g. 'Stop 1', 'Stop 15', '1', '15', 'stop-1')
  const numMatch = rawStr.match(/^(?:stop\s*[-_:]?\s*)?([0-9]{1,2})$/i)
    || rawStr.match(/\bstop\s*[-_:]?\s*([0-9]{1,2})\b/i);
  if (numMatch) {
    const idx = Number.parseInt(numMatch[1], 10) - 1;
    if (idx >= 0 && idx < ROUTE4_STOPS.length) {
      return ROUTE4_STOPS[idx];
    }
  }

  // 2. Exact normalized comparison
  const clean = rawStr.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const exact = ROUTE4_STOPS.find((s) => (
    s.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '') === clean
  ));
  if (exact) return exact;

  // 3. High-priority keyword and landmark mappings
  const lower = rawStr.toLowerCase();
  if (lower.includes('sb road') || lower.includes('sb terminal') || (lower.includes('general luis') && !lower.includes('bayan') && !lower.includes('banahaw')) || (lower.includes('gen. luis') && !lower.includes('bayan') && !lower.includes('banahaw'))) {
    return ROUTE4_STOPS[14]; // Stop 15
  }
  if (lower.includes('banahaw')) return ROUTE4_STOPS[13]; // Stop 14
  if (lower.includes('bayan') || lower.includes('nova bayan')) return ROUTE4_STOPS[12]; // Stop 13
  if (lower.includes('forest hills')) return ROUTE4_STOPS[11]; // Stop 12
  if (lower.includes('sm novaliches') || lower.includes('sm city')) return ROUTE4_STOPS[10]; // Stop 11
  if (lower.includes('qcu') || lower.includes('quezon city university') || lower.includes('novaliches district hospital') || lower.includes('ndh')) return ROUTE4_STOPS[9]; // Stop 10
  if (lower.includes('sauyo')) return ROUTE4_STOPS[7]; // Stop 8
  if (lower.includes('munoz') || lower.includes('muñoz')) return ROUTE4_STOPS[6]; // Stop 7
  if (lower.includes('tandang sora')) return ROUTE4_STOPS[5]; // Stop 6
  if (lower.includes('congressional')) return ROUTE4_STOPS[4]; // Stop 5
  if (lower.includes('tullahan')) return ROUTE4_STOPS[3]; // Stop 4
  if (lower.includes('road 1') || lower.includes('rd 1') || lower.includes('rd. 1')) return ROUTE4_STOPS[2]; // Stop 3
  if (lower.includes('veterans') || lower.includes('vmmc') || lower.includes('vertis')) return ROUTE4_STOPS[1]; // Stop 2
  if (lower.includes('qc hall') || lower.includes('quezon city hall') || lower.includes('nha') || lower.includes('elliptical')) return ROUTE4_STOPS[0]; // Stop 1
  if (lower.includes('quirino') && lower.includes('mindanao')) return ROUTE4_STOPS[8]; // Stop 9

  // 4. Token Jaccard similarity fallback
  const inTokens = tokenizeStop(rawStr);
  if (!inTokens.length) return null;

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

  if (bestScore >= 0.20) return best;
  return null;
}
