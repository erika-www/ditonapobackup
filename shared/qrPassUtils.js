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
 * Creates the canonical, fully readable JSON QR payload string
 */
export function createPassengerQrPayload({
  tripId,
  count = 1,
  category = 'Regular',
  boardingStop = '',
  destinationStop = '',
  busPlate = '',
  companions = 0
}) {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);

  const resolvedTripId = tripId && /^\d{6}-\d{5}$/.test(tripId)
    ? tripId
    : generateDailyTripId();

  const companionsCount = Number(companions) >= 0 ? Number(companions) : Math.max(0, (Number(count) || 1) - 1);
  const totalPax = Math.max(1, Number(count) || (companionsCount + 1));

  const payload = {
    tripId: resolvedTripId,
    passengerCategory: category || 'Regular',
    category: category || 'Regular',
    isPriority: isPriorityCategory(category),
    companions: companionsCount,
    count: totalPax,
    totalPassengers: totalPax,
    boardingStop: String(boardingStop || '').trim(),
    destinationStop: String(destinationStop || '').trim(),
    busPlate: String(busPlate || '').trim(),
    date: `${now.getFullYear()}-${mm}-${dd}`
  };

  return JSON.stringify(payload);
}

/**
 * Universal Parser for QR scanner inputs (camera scan, USB scanner, or manual text).
 * Handles JSON, pipe-delimited, key-value, and legacy strings.
 */
export function parsePassengerQRCode(raw) {
  if (!raw) return null;
  const str = String(raw).trim();

  // 1. JSON parsing
  try {
    const data = JSON.parse(str);
    if (data && (data.tripId || data.passId || data.id)) {
      const tripId = data.tripId || data.passId || data.id;
      const count = Number(data.count || data.passengerCount || data.totalPassengers || 1);
      const companions = Number(data.companions != null ? data.companions : (count > 1 ? count - 1 : 0));
      const category = data.category || data.passengerCategory || 'Regular';
      const boardingStop = data.boardingStop || data.origin || '';
      const destinationStop = data.destinationStop || data.destination || '';

      return {
        tripId,
        count: isNaN(count) || count < 1 ? 1 : count,
        companions: isNaN(companions) || companions < 0 ? 0 : companions,
        category,
        isPriority: isPriorityCategory(category),
        boardingStop,
        destinationStop,
        busPlate: data.busPlate || '',
        raw: str
      };
    }
  } catch (_) {}

  // 2. Formatted Multi-line or Key-Value text
  const tripIdMatch = str.match(/(?:Trip ID|Journey ID|Pass ID|Code):\s*([0-9]{6}-[0-9]{5}|[A-Za-z0-9_-]+)/i);
  const catMatch = str.match(/(?:Category|Passenger Category):\s*([^\r\n]+)/i);
  const boardMatch = str.match(/(?:Boarding Stop|Boarding|From):\s*([^\r\n]+)/i);
  const destMatch = str.match(/(?:Destination Stop|Destination|To):\s*([^\r\n]+)/i);
  const countMatch = str.match(/(?:Count|Passengers):\s*([0-9]+)/i);
  const busMatch = str.match(/(?:Assigned Bus|Bus Plate|Bus):\s*([^\r\n]+)/i);

  if (tripIdMatch) {
    const category = catMatch ? catMatch[1].trim() : 'Regular';
    const count = countMatch ? Number.parseInt(countMatch[1], 10) : 1;
    return {
      tripId: tripIdMatch[1].trim(),
      count: isNaN(count) || count < 1 ? 1 : count,
      category,
      isPriority: isPriorityCategory(category),
      boardingStop: boardMatch ? boardMatch[1].trim() : '',
      destinationStop: destMatch ? destMatch[1].trim() : '',
      busPlate: busMatch ? busMatch[1].trim() : '',
      raw: str
    };
  }

  // 3. Pipe-delimited string (e.g. QCBUS|101526-00001|1|Senior Citizen|Stop 1|Stop 11)
  if (str.includes('|')) {
    const parts = str.split('|').map((p) => p.trim());
    const idIdx = parts.findIndex((p) => /^\d{6}-\d{5}$/.test(p));
    if (idIdx !== -1) {
      const tripId = parts[idIdx];
      const count = Number(parts[idIdx + 1]) || 1;
      const category = parts[idIdx + 2] || 'Regular';
      const boardingStop = parts[idIdx + 3] || '';
      const destinationStop = parts[idIdx + 4] || '';
      return {
        tripId,
        count,
        category,
        isPriority: isPriorityCategory(category),
        boardingStop,
        destinationStop,
        raw: str
      };
    }
  }

  // 4. Standalone MMDDYY-xxxxx regex match
  const standaloneId = str.match(/\b([0-9]{6}-[0-9]{5})\b/);
  if (standaloneId) {
    return {
      tripId: standaloneId[1],
      count: 1,
      category: 'Regular',
      isPriority: false,
      boardingStop: '',
      destinationStop: '',
      raw: str
    };
  }

  return {
    tripId: str.slice(0, 32),
    count: 1,
    category: 'Regular',
    isPriority: false,
    boardingStop: '',
    destinationStop: '',
    raw: str
  };
}
