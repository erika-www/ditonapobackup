/**
 * Geolocation & Spatial Distance Utilities (Haversine Formula)
 * Calculates distance between GPS coordinates in kilometers & meters,
 * finds nearest QC Bus stop to user location, and estimates walking time.
 */

/**
 * Calculates Haversine distance between two (lat, lng) points in kilometers
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const coordinates = [lat1, lon1, lat2, lon2].map(Number);
  if (!coordinates.every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  [lat1, lon1, lat2, lon2] = coordinates;
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates distance in meters between two GPS coordinates
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  return calculateDistanceKm(lat1, lon1, lat2, lon2) * 1000;
}

/**
 * Formats distance into readable meters or kilometers
 */
export function formatDistance(distanceKm) {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }
  return `${distanceKm.toFixed(2)} km`;
}

/**
 * Estimates walking time in minutes based on 4.8 km/h average speed
 */
export function estimateWalkingTimeMins(distanceKm) {
  const walkingSpeedKmH = 4.8;
  const hours = distanceKm / walkingSpeedKmH;
  const minutes = Math.ceil(hours * 60);
  return minutes < 1 ? 1 : minutes;
}

/**
 * Finds the single nearest bus stop from a list of stops given a user's GPS coordinates
 */
export function findNearestStop(userLat, userLng, stopsList = []) {
  const latitude = Number(userLat);
  const longitude = Number(userLng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !stopsList.length) return null;

  let nearest = null;
  let minDistance = Infinity;

  stopsList.forEach((stop) => {
    const stopLat = Number(stop.lat ?? stop.latitude);
    const stopLng = Number(stop.lng ?? stop.longitude);
    if (!Number.isFinite(stopLat) || !Number.isFinite(stopLng)) return;
    const dist = calculateDistanceKm(latitude, longitude, stopLat, stopLng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = {
        stop,
        distanceKm: dist,
        formattedDistance: formatDistance(dist),
        walkingMins: estimateWalkingTimeMins(dist),
      };
    }
  });

  return nearest;
}

/**
 * Samples fresh browser GPS readings and returns the most accurate position.
 * A watch is used because the first mobile reading is often a coarse cached fix.
 */
export function getAccurateCurrentPosition({ desiredAccuracyMeters = 20, timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }

    let bestPosition = null;
    let watchId = null;
    let finished = false;

    const finish = (position, error) => {
      if (finished) return;
      finished = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      clearTimeout(timerId);
      if (position) resolve(position);
      else reject(error || new Error('A current GPS position could not be determined.'));
    };

    const timerId = setTimeout(() => {
      finish(bestPosition, new Error('Location detection timed out.'));
    }, timeoutMs);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const accuracy = Number(position.coords.accuracy);
        if (!bestPosition || accuracy < Number(bestPosition.coords.accuracy)) {
          bestPosition = position;
        }
        if (Number.isFinite(accuracy) && accuracy <= desiredAccuracyMeters) {
          finish(position);
        }
      },
      (error) => finish(bestPosition, error),
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs }
    );
  });
}

export { checkDestinationReached, getRoute4DestinationStop, haversineDistanceMeters } from '@shared/route4Stops';

