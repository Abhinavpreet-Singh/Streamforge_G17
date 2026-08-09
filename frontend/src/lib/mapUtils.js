const US_CITIES = [
  { lat: 40.7128, lng: -74.0060 },
  { lat: 34.0522, lng: -118.2437 },
  { lat: 41.8781, lng: -87.6298 },
  { lat: 29.7604, lng: -95.3698 },
  { lat: 39.7392, lng: -104.9903 },
  { lat: 47.6062, lng: -122.3321 },
  { lat: 25.7617, lng: -80.1918 },
  { lat: 32.7767, lng: -96.7970 },
];

export function getTruckRoute(truckId) {
  const seed = (truckId * 12345.67) % 1;
  const startIdx = Math.floor(seed * US_CITIES.length);
  const endIdx = (startIdx + 1) % US_CITIES.length;
  return { startCity: US_CITIES[startIdx], endCity: US_CITIES[endIdx], seed };
}

export function calculateCurrentPosition(truckId, timeSecs) {
  const { startCity, endCity, seed } = getTruckRoute(truckId);
  const speed = 0.005 + seed * 0.01;
  const progress = (timeSecs * speed + seed) % 1.0;
  const lat = startCity.lat + (endCity.lat - startCity.lat) * progress;
  const lng = startCity.lng + (endCity.lng - startCity.lng) * progress;
  return [lat, lng];
}
