import { deriveLocalityKey, parseGeoCoord } from "./donorNeighbourhoodArea.js";

/**
 * @param {unknown} payload
 * @returns {{ lat: number, lng: number, label: string, localityKey: string } | null}
 */
export function locationFromPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const lat = parseGeoCoord(payload.location_lat, "lat");
  const lng = parseGeoCoord(payload.location_lng, "lng");
  if (lat == null || lng == null) {
    return null;
  }
  const label =
    typeof payload.location_label === "string"
      ? payload.location_label.trim()
      : "";
  const suppliedKey =
    typeof payload.locality_key === "string"
      ? payload.locality_key.trim()
      : "";
  const localityKey = suppliedKey || deriveLocalityKey(lat, lng);
  return { lat, lng, label, localityKey };
}

/**
 * @param {object} record
 * @param {ReturnType<typeof locationFromPayload>} location
 */
export function applyLocationToRecord(record, location) {
  if (!location) {
    return {
      ...record,
      location_lat: null,
      location_lng: null,
      location_label: "",
      locality_key: ""
    };
  }
  return {
    ...record,
    location_lat: location.lat,
    location_lng: location.lng,
    location_label: location.label,
    locality_key: location.localityKey
  };
}

export function mergeLocationFromPayload(existing, payload) {
  const incoming = locationFromPayload(payload);
  if (incoming) {
    return applyLocationToRecord(existing, incoming);
  }
  if (payload?.location_lat === null && payload?.location_lng === null) {
    return applyLocationToRecord(existing, null);
  }
  return existing;
}

export function recordHasLocation(record) {
  return (
    typeof record?.location_lat === "number" &&
    typeof record?.location_lng === "number" &&
    Number.isFinite(record.location_lat) &&
    Number.isFinite(record.location_lng)
  );
}
