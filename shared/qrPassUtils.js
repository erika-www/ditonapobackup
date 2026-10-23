import { resolveRoute4Stop } from './route4Stops.js';

/**
 * Shared QR Pass & Passenger Category Utilities
 * Standardizes:
 * 1. Daily Trip ID Generation: MMDDYY-xxxxx
 * 2. Passenger Category Assessment (Priority vs Non-Priority Seats)
 * 3. Scannable QR Payload serialization and parsing
 */

/**
 * Returns true if the passenger category qualifies for designated Priority Seating
 * (Senior Citizens, Persons with Disabilities, Pregnant passengers).
 */
export function isPriorityCategory(category) {
  if (!category) return false;
  const normalized = String(category).trim().toLowerCase();
  return (
    normalized.includes('senior') ||
    normalized.includes('pwd') ||
    normalized.includes('disab') ||
    normalized.includes('pregnant')
  );
}

/**
 * Generates a unique trip ID formatted strictly as MMDDYY-xxxxx per passenger per day
 * where xxxxx is a unique 5-digit sequence counter.
 */
export function generateDailyTripId(options = {}) {
  const now = options.date ? new Date(options.date) : new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const datePrefix = `${mm}${dd}${yy}`; // e.g. "101526"

  // Storage key for daily sequence counter
  const storageKey = `qcbus_pax_seq_${datePrefix}`;
  let seq = 1;

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem(storageKey);
      seq = saved ? Number.parseInt(saved, 10) + 1 : 1;
      window.localStorage.setItem(storageKey, String(seq));
    } catch (_) {
      seq = Math.floor(Math.random() * 90000) + 10000;
    }
  } else {
    seq = Math.floor(Math.random() * 90000) + 10000;
  }

  const xxxxx = String(seq).padStart(5, '0');
  return `${datePrefix}-${xxxxx}`;
}

/**
 * Extracts a human-readable stop name from either a string or an object with name/title/label
 */
export function extractStopName(s) {
  if (!s) return '';
  if (typeof s === 'string') return s.trim();
  if (typeof s === 'object' && s !== null) {
    return (
      s.name ||
      s.stopName ||
      s.stop_name ||
      s.origin_name ||
      s.destination_name ||
      s.title ||
      s.label ||
      s.landmark ||
      s.stop ||
      ''
    ).trim();
  }
  return String(s).trim();
}

/**
 * Returns true if the party (passenger and/or any companion) has at least one priority member
 */
export function hasPriorityInParty(passengerCategory, companionsList = []) {
  if (isPriorityCategory(passengerCategory)) return true;
  if (Array.isArray(companionsList)) {
    return companionsList.some((c) => isPriorityCategory(c?.category));
  }
  return false;
}

/**
 * Creates the canonical, fully readable JSON QR payload string
 */
/**
 * Creates the clean, human-readable QR payload string containing strictly the 6 requested items:
 * 1. The trip id
 * 2. The passenger category
 * 3. The number of passenger in that trip id
 * 4. Boarding stop
 * 5. Destination stop
 * 6. Time boarded
 */
export function createPassengerQrPayload({
  tripId,
  count = 1,
  category = 'Regular',
  boardingStop = '',
  destinationStop = '',
  busPlate = '',
  companions = 0,
  direction = 'Northbound',
  companionsList = [],
  timeBoarded = '',
  asJson = false
}) {
  const now = new Date();

  const resolvedTripId = tripId && /^\d{6}-\d{5}$/.test(tripId)
    ? tripId
    : generateDailyTripId();

  const companionsCount = Number(companions) >= 0 ? Number(companions) : Math.max(0, (Number(count) || 1) - 1);
  const totalPax = Math.max(1, Number(count) || (companionsCount + 1));
  const rawB = extractStopName(boardingStop);
  const rawD = extractStopName(destinationStop);
  const normalizedDirection = String(direction || 'Northbound').trim().toLowerCase().includes('south')
    ? 'Southbound'
    : 'Northbound';

  const resolvedOrigin = resolveRoute4Stop(rawB, normalizedDirection);
  const resolvedDest = resolveRoute4Stop(rawD, normalizedDirection);
  const bStop = resolvedOrigin ? (resolvedOrigin.canonicalDbName || resolvedOrigin.name) : rawB;
  const dStop = resolvedDest ? (resolvedDest.canonicalDbName || resolvedDest.name) : rawD;

  const formattedTime = timeBoarded
    ? String(timeBoarded).trim()
    : now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (asJson) {
    return JSON.stringify({
      tripId: resolvedTripId,
      passengerCategory: category || 'Regular',
      numberOfPassengers: totalPax,
      boardingStop: bStop,
      destinationStop: dStop,
      timeBoarded: formattedTime
    });
  }

  // Strictly output the 6 requested fields formatted cleanly for phone scanning
  return [
    `Trip ID: ${resolvedTripId}`,
    `Passenger Category: ${category || 'Regular'}`,
    `Number of Passengers: ${totalPax}`,
    `Boarding Stop: ${bStop}`,
    `Destination Stop: ${dStop}`,
    `Time Boarded: ${formattedTime}`
  ].join('\n');
}

/**
 * Universal Parser for QR scanner inputs (camera scan, USB scanner, or manual text).
 * Handles clean 6-line text format, JSON, pipe-delimited, and standalone IDs.
 */
export function parsePassengerQRCode(raw) {
  if (!raw) return null;

  const getOrigin = (o) => extractStopName(
    o.boardingStop || o.boarding_stop || o.origin_name || o.origin ||
    o.fromStop || o.from_stop || o.from || o.startStop || o.start_stop ||
    o.pickupStop || o.pickup_stop || o.pickup || o.boarding || ''
  );
  const getDest = (o) => extractStopName(
    o.destinationStop || o.destination_stop || o.alightingStop || o.alighting_stop ||
    o.destination_name || o.destination || o.toStop || o.to_stop || o.to ||
    o.endStop || o.end_stop || o.dropoffStop || o.dropoff_stop || o.dropoff ||
    o.alighting || ''
  );
  const getDirection = (o) => {
    const rawDir = o.direction || o.tripDirection || o.routeDirection || o.trip_direction || o.bound || '';
    if (rawDir) {
      return String(rawDir).trim().toLowerCase().includes('south') ? 'Southbound' : 'Northbound';
    }
    const b = getOrigin(o);
    const d = getDest(o);
    const inferred = detectPassengerDirection(b, d);
    return inferred || 'Northbound';
  };

  const resolveStopsInResult = (res) => {
    if (!res) return res;
    const resolvedB = resolveRoute4Stop(res.boardingStop, res.direction);
    const resolvedD = resolveRoute4Stop(res.destinationStop, res.direction);
    const bName = resolvedB ? (resolvedB.canonicalDbName || resolvedB.name) : (res.boardingStop || '');
    const dName = resolvedD ? (resolvedD.canonicalDbName || resolvedD.name) : (res.destinationStop || '');
    return {
      ...res,
      boardingStop: bName,
      destinationStop: dName,
      origin_name: bName,
      destination_name: dName,
      resolvedBoardingStop: resolvedB,
      resolvedDestinationStop: resolvedD
    };
  };

  // 0. Direct object input
  if (typeof raw === 'object' && raw !== null) {
    const tripId = raw.tripId || raw.trip_id || raw.passId || raw.id || raw.dailyTripId || raw.qr_token || raw.token || 'PASS-00001';
    const count = Number(raw.numberOfPassengers || raw.number_of_passengers || raw.count || raw.passengerCount || raw.passenger_count || raw.totalPassengers || raw.passengers || 1);
    const companions = Number(raw.companions != null ? raw.companions : (count > 1 ? count - 1 : 0));
    const category = raw.category || raw.passengerCategory || raw.passenger_category || 'Regular';
    const boardingStop = getOrigin(raw);
    const destinationStop = getDest(raw);
    const direction = getDirection(raw);
    const companionsList = Array.isArray(raw.companionsList) ? raw.companionsList : [];
    const timeBoarded = raw.timeBoarded || raw.time_boarded || raw.time || '';

    return resolveStopsInResult({
      tripId: String(tripId).trim(),
      count: isNaN(count) || count < 1 ? 1 : count,
      companions: isNaN(companions) || companions < 0 ? 0 : companions,
      companionsList,
      category: String(category).trim(),
      isPriority: isPriorityCategory(category),
      hasPriorityInParty: hasPriorityInParty(category, companionsList),
      direction,
      tripDirection: direction,
      routeDirection: direction,
      boardingStop,
      destinationStop,
      timeBoarded,
      busPlate: String(raw.busPlate || raw.plateNumber || raw.bus_plate || '').trim(),
      raw: JSON.stringify(raw)
    });
  }

  const str = String(raw).trim();

  // 1. JSON parsing (including embedded JSON within brackets)
  try {
    let jsonStr = str;
    const firstBrace = str.indexOf('{');
    const lastBrace = str.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = str.substring(firstBrace, lastBrace + 1);
    }
    const data = JSON.parse(jsonStr);
    if (data && (data.tripId || data.trip_id || data.passId || data.id || data.dailyTripId || data.qr_token || data.token || getOrigin(data) || getDest(data))) {
      const tripId = data.tripId || data.trip_id || data.passId || data.id || data.dailyTripId || data.qr_token || data.token || generateDailyTripId();
      const count = Number(data.numberOfPassengers || data.number_of_passengers || data.count || data.passengerCount || data.passenger_count || data.totalPassengers || data.passengers || 1);
      const companions = Number(data.companions != null ? data.companions : (count > 1 ? count - 1 : 0));
      const category = data.category || data.passengerCategory || data.passenger_category || 'Regular';
      const boardingStop = getOrigin(data);
      const destinationStop = getDest(data);
      const direction = getDirection(data);
      const companionsList = Array.isArray(data.companionsList) ? data.companionsList : [];
      const timeBoarded = data.timeBoarded || data.time_boarded || data.time || '';

      return resolveStopsInResult({
        tripId: String(tripId).trim(),
        count: isNaN(count) || count < 1 ? 1 : count,
        companions: isNaN(companions) || companions < 0 ? 0 : companions,
        companionsList,
        category: String(category).trim(),
        isPriority: isPriorityCategory(category),
        hasPriorityInParty: hasPriorityInParty(category, companionsList),
        direction,
        tripDirection: direction,
        routeDirection: direction,
        boardingStop,
        destinationStop,
        timeBoarded,
        busPlate: String(data.busPlate || data.plateNumber || data.bus_plate || '').trim(),
        raw: str
      });
    }
  } catch (_) { }

  // 2. Formatted Multi-line or Key-Value text (e.g. matching 6-field phone QR payload)
  const tripIdMatch = str.match(/(?:Trip ID|TripId|Journey ID|Pass ID|Pass|Ticket|Code):\s*([0-9]{6}-[0-9]{5}|[A-Za-z0-9_-]+)/i);
  const catMatch = str.match(/(?:Passenger Category|Category|Type):\s*([^\r\n,]+)/i);
  const countMatch = str.match(/(?:Number of Passengers|Number of Passenger|Passenger Count|Passengers|Count|Pax|Seats|Qty):\s*([0-9]+)/i);
  const boardMatch = str.match(/(?:Boarding Stop|Boarding|Origin|From|Pickup|Start Stop|Start):\s*([^\r\n,]+)/i);
  const destMatch = str.match(/(?:Destination Stop|Destination|Alighting Stop|Alighting|Dropoff|To|End Stop|End):\s*([^\r\n,]+)/i);
  const timeMatch = str.match(/(?:Time Boarded|Time|Boarded At|Boarding Time):\s*([^\r\n,]+)/i);
  const busMatch = str.match(/(?:Assigned Bus|Bus Plate|Bus|Unit):\s*([^\r\n,]+)/i);
  const dirMatch = str.match(/(?:Direction|Heading|Bound):\s*([^\r\n,]+)/i);

  if (tripIdMatch || boardMatch || destMatch) {
    const category = catMatch ? catMatch[1].trim() : 'Regular';
    const count = countMatch ? Number.parseInt(countMatch[1], 10) : 1;
    const boardingStop = boardMatch ? extractStopName(boardMatch[1]) : '';
    const destinationStop = destMatch ? extractStopName(destMatch[1]) : '';
    let direction = 'Northbound';
    if (dirMatch && dirMatch[1].toLowerCase().includes('south')) {
      direction = 'Southbound';
    } else {
      const inferred = detectPassengerDirection(boardingStop, destinationStop);
      if (inferred) direction = inferred;
    }

    return resolveStopsInResult({
      tripId: tripIdMatch ? tripIdMatch[1].trim() : (str.match(/\b([0-9]{6}-[0-9]{5})\b/)?.[1] || generateDailyTripId()),
      count: isNaN(count) || count < 1 ? 1 : count,
      companions: count > 1 ? count - 1 : 0,
      companionsList: [],
      category,
      isPriority: isPriorityCategory(category),
      hasPriorityInParty: isPriorityCategory(category),
      direction,
      tripDirection: direction,
      routeDirection: direction,
      boardingStop,
      destinationStop,
      timeBoarded: timeMatch ? timeMatch[1].trim() : '',
      busPlate: busMatch ? busMatch[1].trim() : '',
      raw: str
    });
  }

  // 3. Pipe-delimited string (e.g. QCBUS|101526-00001|1|Senior Citizen|Stop 1|Stop 11|Northbound)
  if (str.includes('|')) {
    const parts = str.split('|').map((p) => p.trim());
    const idIdx = parts.findIndex((p) => /^\d{6}-\d{5}$/.test(p));
    if (idIdx !== -1) {
      const tripId = parts[idIdx];
      const count = Number(parts[idIdx + 1]) || 1;
      const category = parts[idIdx + 2] || 'Regular';
      const boardingStop = extractStopName(parts[idIdx + 3]) || '';
      const destinationStop = extractStopName(parts[idIdx + 4]) || '';
      const rawDir = parts[idIdx + 5] || '';
      const direction = rawDir.toLowerCase().includes('south')
        ? 'Southbound'
        : (detectPassengerDirection(boardingStop, destinationStop) || 'Northbound');
      return resolveStopsInResult({
        tripId,
        count: isNaN(count) || count < 1 ? 1 : count,
        companions: count > 1 ? count - 1 : 0,
        companionsList: [],
        category,
        isPriority: isPriorityCategory(category),
        hasPriorityInParty: isPriorityCategory(category),
        direction,
        tripDirection: direction,
        routeDirection: direction,
        boardingStop,
        destinationStop,
        timeBoarded: '',
        busPlate: '',
        raw: str
      });
    }
  }

  // 4. Standalone MMDDYY-xxxxx regex match
  const standaloneId = str.match(/\b([0-9]{6}-[0-9]{5})\b/);
  if (standaloneId) {
    return resolveStopsInResult({
      tripId: standaloneId[1],
      count: 1,
      companions: 0,
      companionsList: [],
      category: 'Regular',
      isPriority: false,
      hasPriorityInParty: false,
      direction: 'Northbound',
      tripDirection: 'Northbound',
      routeDirection: 'Northbound',
      boardingStop: '',
      destinationStop: '',
      timeBoarded: '',
      busPlate: '',
      raw: str
    });
  }

  return resolveStopsInResult({
    tripId: str.slice(0, 32),
    count: 1,
    companions: 0,
    companionsList: [],
    category: 'Regular',
    isPriority: false,
    hasPriorityInParty: false,
    direction: 'Northbound',
    tripDirection: 'Northbound',
    routeDirection: 'Northbound',
    boardingStop: '',
    destinationStop: '',
    timeBoarded: '',
    busPlate: '',
    raw: str
  });
}
