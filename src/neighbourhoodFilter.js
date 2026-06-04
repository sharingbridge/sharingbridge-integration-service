import { isCoordinatorApiRole } from "./orderIntentViews.js";
import {
  deriveLocalityKey,
  getDonorLocalityGridDecimals,
  parseNeighbourhoodQuery
} from "./donorNeighbourhoodArea.js";
import { recordHasLocation } from "./orderIntentLocation.js";

const EARTH_RADIUS_M = 6_371_000;

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

/** @returns {number} distance in metres */
export function haversineDistanceM(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/**
 * @param {object} record
 * @param {{ type: "near", nearLat: number, nearLng: number, radiusM: number } | { type: "locality", localityKey: string }} scope
 */
export function intentMatchesNeighbourhood(record, scope) {
  if (!recordHasLocation(record)) {
    return false;
  }
  if (scope.type === "locality") {
    return record.locality_key === scope.localityKey;
  }
  const distance = haversineDistanceM(
    scope.nearLat,
    scope.nearLng,
    record.location_lat,
    record.location_lng
  );
  return distance <= scope.radiusM;
}

/**
 * @param {URLSearchParams} params
 * @param {string} role
 * @returns {{ type: "near", nearLat: number, nearLng: number, radiusM: number } | { type: "locality", localityKey: string } | null}
 */
export function resolveNeighbourhoodScope(role, params) {
  const { nearLat, nearLng, localityKey, radiusM } = parseNeighbourhoodQuery(params);
  if (nearLat != null && nearLng != null) {
    return { type: "near", nearLat, nearLng, radiusM };
  }
  if (localityKey) {
    return { type: "locality", localityKey };
  }
  if (isCoordinatorApiRole(role)) {
    return null;
  }
  return null;
}

/**
 * Donor without viewer location: only their own rows (still subject to since).
 * With scope: own rows + neighbours within radius/locality.
 */
export function filterRecordsByNeighbourhood(
  records,
  scope,
  viewerUserId,
  role = ""
) {
  const viewer = typeof viewerUserId === "string" ? viewerUserId.trim() : "";
  if (!scope) {
    if (!viewer || isCoordinatorApiRole(role)) {
      return records;
    }
    return records.filter((record) => record.user_id === viewer);
  }
  return records.filter((record) => {
    if (viewer && record.user_id === viewer) {
      return true;
    }
    if (!recordHasLocation(record)) {
      // No handover GPS at registration — still visible in the time window for By area.
      return scope.type === "near";
    }
    return intentMatchesNeighbourhood(record, scope);
  });
}

export function formatNeighbourhoodResponse(scope) {
  if (!scope) {
    return null;
  }
  if (scope.type === "locality") {
    return {
      mode: "locality_key",
      locality_key: scope.localityKey
    };
  }
  return {
    mode: "near",
    near_lat: scope.nearLat,
    near_lng: scope.nearLng,
    radius_m: scope.radiusM,
    viewer_locality_key: deriveLocalityKey(
      scope.nearLat,
      scope.nearLng,
      getDonorLocalityGridDecimals()
    )
  };
}
