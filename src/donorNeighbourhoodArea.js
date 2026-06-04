const DEFAULT_RADIUS_M = 5000;
const MIN_RADIUS_M = 500;
const MAX_RADIUS_M = 50_000;
const DEFAULT_GRID_DECIMALS = 2;
const MIN_GRID_DECIMALS = 1;
const MAX_GRID_DECIMALS = 4;

const DEFAULT_RADIUS_KM = 5;
const MIN_RADIUS_KM = 0.5;
const MAX_RADIUS_KM = 50;

/**
 * @param {string | number | undefined} raw
 * @returns {number} metres
 */
export function parseDonorNeighbourhoodRadiusM(raw) {
  const parsed = Number(String(raw ?? DEFAULT_RADIUS_M).trim());
  if (!Number.isFinite(parsed)) {
    return DEFAULT_RADIUS_M;
  }
  return Math.min(MAX_RADIUS_M, Math.max(MIN_RADIUS_M, Math.round(parsed)));
}

/**
 * Legacy km parser (used only when `DONOR_NEIGHBOURHOOD_RADIUS_M` is unset).
 * @param {string | number | undefined} raw
 * @returns {number} kilometres
 */
export function parseDonorNeighbourhoodRadiusKm(raw) {
  const parsed = Number(String(raw ?? DEFAULT_RADIUS_KM).trim());
  if (!Number.isFinite(parsed)) {
    return DEFAULT_RADIUS_KM;
  }
  return Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, parsed));
}

/** From `DONOR_NEIGHBOURHOOD_RADIUS_M` (default 5000), or legacy `DONOR_NEIGHBOURHOOD_RADIUS_KM` × 1000. */
export function getDonorNeighbourhoodRadiusM() {
  const metresRaw = process.env.DONOR_NEIGHBOURHOOD_RADIUS_M;
  if (metresRaw != null && String(metresRaw).trim() !== "") {
    return parseDonorNeighbourhoodRadiusM(metresRaw);
  }
  const kmRaw = process.env.DONOR_NEIGHBOURHOOD_RADIUS_KM;
  if (kmRaw != null && String(kmRaw).trim() !== "") {
    return Math.round(parseDonorNeighbourhoodRadiusKm(kmRaw) * 1000);
  }
  return DEFAULT_RADIUS_M;
}

/** Kilometres derived from the active radius in metres (UI copy only). */
export function getDonorNeighbourhoodRadiusKm() {
  return getDonorNeighbourhoodRadiusM() / 1000;
}

export function parseDonorLocalityGridDecimals(raw) {
  const parsed = Number(String(raw ?? DEFAULT_GRID_DECIMALS).trim());
  if (!Number.isFinite(parsed)) {
    return DEFAULT_GRID_DECIMALS;
  }
  return Math.min(
    MAX_GRID_DECIMALS,
    Math.max(MIN_GRID_DECIMALS, Math.round(parsed))
  );
}

export function getDonorLocalityGridDecimals() {
  return parseDonorLocalityGridDecimals(
    process.env.DONOR_LOCALITY_GRID_DECIMALS
  );
}

/**
 * Grid key for grouping / exact locality filter (lat,lng rounded).
 * @param {number} lat
 * @param {number} lng
 */
export function deriveLocalityKey(lat, lng, decimals = getDonorLocalityGridDecimals()) {
  return `${lat.toFixed(decimals)},${lng.toFixed(decimals)}`;
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
  const localityKey =
    typeof params.get("locality_key") === "string"
      ? params.get("locality_key").trim()
      : "";
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
