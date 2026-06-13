import { normalizeLocalityKey } from "./localityKey.js";

const DEFAULT_RADIUS_M = 5000;
/** Upper bound only — prevents oversized ST_DWithin scans; no high minimum floor. */
const MAX_RADIUS_M = 50_000;

/**
 * @param {string | number | undefined} raw
 * @returns {number} metres
 */
export function parseDonorNeighbourhoodRadiusM(raw) {
  if (raw == null || raw === "") {
    return DEFAULT_RADIUS_M;
  }
  const parsed = Number(String(raw).trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_RADIUS_M;
  }
  return Math.min(MAX_RADIUS_M, Math.round(parsed));
}

/** From `INITIATOR_NEIGHBOURHOOD_RADIUS_M` (default 5000 m). */
export function getDonorNeighbourhoodRadiusM() {
  return parseDonorNeighbourhoodRadiusM(
    process.env.INITIATOR_NEIGHBOURHOOD_RADIUS_M
  );
}

/**
 * @param {string | null | undefined} value
 * @param {"lat" | "lng"} kind
 * @returns {number | null}
 */
export function parseGeoCoord(value, kind) {
  if (value == null || value === "") {
    return null;
  }
  const n = Number(String(value).trim());
  if (!Number.isFinite(n)) {
    return null;
  }
  if (kind === "lat") {
    return n >= -90 && n <= 90 ? n : null;
  }
  return n >= -180 && n <= 180 ? n : null;
}

/**
 * @param {URLSearchParams} params
 */
export function parseNeighbourhoodQuery(params) {
  const nearLat = parseGeoCoord(params.get("near_lat"), "lat");
  const nearLng = parseGeoCoord(params.get("near_lng"), "lng");
  const localityKey = normalizeLocalityKey(params.get("locality_key") ?? "");
  let radiusM = getDonorNeighbourhoodRadiusM();
  const radiusRaw = params.get("radius_m");
  if (radiusRaw != null && radiusRaw !== "") {
    const parsed = Number(String(radiusRaw).trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      radiusM = Math.min(Math.round(parsed), getDonorNeighbourhoodRadiusM());
    }
  }
  return {
    nearLat,
    nearLng,
    localityKey: localityKey || null,
    radiusM
  };
}
