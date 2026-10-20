import { RF_QUEUE_PREDICTIONS, RF_RECOMMENDED_BOARDING } from './data/rfPredictions.js';
import { resolveRoute4Stop, ROUTE4_STOPS, SOUTHBOUND_ROUTE4_STOPS } from './route4Stops.js';

export { RF_QUEUE_PREDICTIONS, RF_RECOMMENDED_BOARDING };

/**
 * Determines current operational period based on minutes from midnight (0 to 1439).
 */
export function getOperationalPeriod(minutes) {
  if (minutes >= 360 && minutes < 540) return { key: 'morning_peak', label: 'Morning Rush (6AM-9AM)' };
  if (minutes >= 540 && minutes < 960) return { key: 'midday', label: 'Midday (9AM-4PM)' };
  if (minutes >= 960 && minutes < 1200) return { key: 'evening_peak', label: 'Evening Rush (4PM-8PM)' };
  if (minutes >= 1200 && minutes <= 1320) return { key: 'night', label: 'Night (8PM-10PM)' };
  if (minutes < 360) return { key: 'early_morning', label: 'Early Morning (Before 6AM)' };
  return { key: 'off_hours', label: 'Off Hours' };
}

/**
 * Retrieves Random Forest queue prediction schedule for a given stop.
 * Returns all 54 intervals:
 * - 05:00 to 09:00: every 15 mins (16 intervals)
 * - 09:00 to 16:00: every 30 mins (14 intervals)
 * - 16:00 to 22:00: every 15 mins (24 intervals)
 */
export function getStopQueueSchedule(stopInput, now = new Date()) {
  const resolved = resolveRoute4Stop(stopInput);
  if (!resolved) return null;

  // Find predictions by canonical name or shortName
  const stopData = RF_QUEUE_PREDICTIONS.stops[resolved.name] ||
                   RF_QUEUE_PREDICTIONS.stops[resolved.canonicalDbName] ||
                   Object.values(RF_QUEUE_PREDICTIONS.stops).find(
                     s => s.canonicalName === resolved.name || s.stopNumber === resolved.stopNumber
                   );

  if (!stopData) return null;

  const currentMins = now.getHours() * 60 + now.getMinutes();

  // Find active time slot
  let activeSlot = null;
  for (const slot of stopData.slots) {
    const slotDef = RF_QUEUE_PREDICTIONS.slots.find(s => s.slotId === slot.slotId);
    if (slotDef && currentMins >= slotDef.startMin && currentMins < slotDef.endMin) {
      activeSlot = { ...slot, isActive: true };
      break;
    }
  }

  // If before operational hours or after hours, clamp to nearest slot
  if (!activeSlot && stopData.slots.length > 0) {
    if (currentMins < 300) {
      activeSlot = { ...stopData.slots[0], isActive: false, isUpcoming: true };
    } else {
      activeSlot = { ...stopData.slots[stopData.slots.length - 1], isActive: false, isClosed: true };
    }
  }

  // Calculate period averages
  const morningSlots = stopData.slots.filter(s => s.period === 'Morning Peak');
  const middaySlots = stopData.slots.filter(s => s.period === 'Midday Off-Peak');
  const eveningSlots = stopData.slots.filter(s => s.period === 'Evening Peak');
  const nightSlots = stopData.slots.filter(s => s.period === 'Night');

  const calcAvg = (arr) => arr.length ? Math.round(arr.reduce((acc, c) => acc + c.predictedQueue, 0) / arr.length) : 0;

  const morningAvg = calcAvg(morningSlots);
  const middayAvg = calcAvg(middaySlots);
  const eveningAvg = calcAvg(eveningSlots);
  const nightAvg = calcAvg(nightSlots);

  // Busiest interval
  const busiest = [...stopData.slots].sort((a, b) => b.predictedQueue - a.predictedQueue)[0];

  return {
    stop: resolved,
    canonicalName: stopData.canonicalName,
    shortName: stopData.shortName,
    stopNumber: stopData.stopNumber,
    metadata: RF_QUEUE_PREDICTIONS.metadata,
    slots: stopData.slots.map(s => ({
      ...s,
      isCurrent: activeSlot?.slotId === s.slotId
    })),
    currentSlot: activeSlot,
    summary: {
      morningPeakAvg: morningAvg,
      middayAvg: middayAvg,
      eveningPeakAvg: eveningAvg,
      nightAvg: nightAvg,
      busiestSlot: busiest
    }
  };
}

/**
 * Retrieves recommended number of passengers to be boarded at a stop for personnel app.
 * Direction: 'Northbound' | 'Southbound'
 */
export function getStopRecommendedBoarding(stopInput, direction = 'Northbound', now = new Date()) {
  const resolved = resolveRoute4Stop(stopInput, direction);
  if (!resolved) return null;

  const dirKey = String(direction).toLowerCase().includes('south') ? 'Southbound' : 'Northbound';
  const dirPool = RF_RECOMMENDED_BOARDING.byDirectionAndStop[dirKey] || {};

  const rec = dirPool[resolved.name] ||
              dirPool[resolved.canonicalDbName] ||
              Object.values(dirPool).find(s => s.stopNumber === resolved.stopNumber);

  if (!rec) {
    return {
      stopNumber: resolved.stopNumber,
      stopName: resolved.name,
      direction: dirKey,
      overallRecommended: 0,
      recommendedRange: '0 pax',
      currentPeriodRecommended: 0,
      isTerminal: false,
      byPeriod: { morning_peak: 0, midday: 0, evening_peak: 0, night: 0 }
    };
  }

  const currentMins = now.getHours() * 60 + now.getMinutes();
  const period = getOperationalPeriod(currentMins);

  const currentPeriodVal = rec.isTerminal ? 0 : (
    rec.byPeriod[period.key] != null ? rec.byPeriod[period.key] : rec.overallRecommended
  );

  return {
    ...rec,
    direction: dirKey,
    currentPeriodRecommended: currentPeriodVal,
    currentPeriodLabel: period.label,
    metadata: RF_RECOMMENDED_BOARDING.metadata
  };
}

/**
 * Retrieves full recommended boarding list for all 15 stops along given travel direction.
 */
export function getAllStopsRecommendedBoarding(direction = 'Northbound', now = new Date()) {
  const dirKey = String(direction).toLowerCase().includes('south') ? 'Southbound' : 'Northbound';
  const baseStops = dirKey === 'Southbound' ? SOUTHBOUND_ROUTE4_STOPS : ROUTE4_STOPS;

  return baseStops.map((s, idx) => {
    const rec = getStopRecommendedBoarding(s, dirKey, now);
    return {
      ...s,
      sequenceNumber: idx + 1,
      recommendation: rec
    };
  });
}
