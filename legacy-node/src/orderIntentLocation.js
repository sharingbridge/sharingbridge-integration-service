import { parseGeoCoord } from "./donorNeighbourhoodArea.js";
import { isValidLocalityKey } from "./localityKey.js";
import { derivePostalLocalityKey } from "./postalGeocode.js";

/**
 * @param {unknown} payload
 * @returns {Promise<{ lat: number, lng: number, label: string, localityKey: string } | null>}
 */
export async function locationFromPayload(payload) {
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
  let localityKey = "";
  if (suppliedKey && isValidLocalityKey(suppliedKey)) {
    localityKey = suppliedKey;
  } else {
    localityKey = (await derivePostalLocalityKey(lat, lng)) ?? "";
  }
  return { lat, lng, label, localityKey };
}

/**
 * @param {object} record
 * @param {Awaited<ReturnType<typeof locationFromPayload>>} location
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

export async function mergeLocationFromPayload(existing, payload) {
  const incoming = await locationFromPayload(payload);
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
