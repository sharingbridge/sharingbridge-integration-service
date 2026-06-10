const DEFAULT_RADIUS_M = 5000;
/** Upper bound only — prevents oversized ST_DWithin scans; no high minimum floor. */
const MAX_RADIUS_M = 50_000;
const DEFAULT_GRID_DECIMALS = 2;
const MIN_GRID_DECIMALS = 1;
const MAX_GRID_DECIMALS = 4;
/** Mean km per degree latitude (WGS84 approximation). */
const KM_PER_DEG_LAT = 111.32;
const MIN_BUCKET_KM = 0.5;
const MAX_BUCKET_KM = 50;

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

/** From `DONOR_NEIGHBOURHOOD_RADIUS_M` (default 5000 metres). */
export function getDonorNeighbourhoodRadiusM() {
  return parseDonorNeighbourhoodRadiusM(
    process.env.DONOR_NEIGHBOURHOOD_RADIUS_M
  );
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

export function parseDonorLocalityBucketKm(raw) {
  if (raw == null || raw === "") {
    return null;
  }
  const parsed = Number(String(raw).trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.min(MAX_BUCKET_KM, Math.max(MIN_BUCKET_KM, parsed));
}

/**
 * When set, demand-board locality_key uses a km-wide grid instead of decimal rounding.
 * Example: `5` → ~5 km cells (latitude-adjusted for longitude).
 */
export function getDonorLocalityBucketKm() {
  return parseDonorLocalityBucketKm(process.env.DONOR_LOCALITY_BUCKET_KM);
}

function formatBucketCoord(value, step) {
  const decimals = Math.min(6, Math.max(2, Math.ceil(-Math.log10(step)) + 1));
  return value.toFixed(decimals);
}

/**
 * Snap lat/lng to the centre of a ~bucketKm square cell for stable grouping keys.
 * @param {number} lat
 * @param {number} lng
 * @param {number} bucketKm
 */
export function deriveLocalityKeyFromBucketKm(lat, lng, bucketKm) {
  const latStep = bucketKm / KM_PER_DEG_LAT;
  const lngKmPerDeg =
    KM_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  const lngStep = bucketKm / Math.max(lngKmPerDeg, 0.001);
  const snappedLat = Math.round(lat / latStep) * latStep;
  const snappedLng = Math.round(lng / lngStep) * lngStep;
  return `${formatBucketCoord(snappedLat, latStep)},${formatBucketCoord(snappedLng, lngStep)}`;
}

function deriveLocalityKeyFromGridDecimals(lat, lng, decimals) {
  return `${lat.toFixed(decimals)},${lng.toFixed(decimals)}`;
}

/**
 * Grid key for grouping / exact locality filter.
 * Prefers DONOR_LOCALITY_BUCKET_KM when set; otherwise decimal grid (legacy).
 * @param {number} lat
 * @param {number} lng
 */
export function deriveLocalityKey(lat, lng) {
  const bucketKm = getDonorLocalityBucketKm();
  if (bucketKm != null) {
    return deriveLocalityKeyFromBucketKm(lat, lng, bucketKm);
  }
  return deriveLocalityKeyFromGridDecimals(
    lat,
    lng,
    getDonorLocalityGridDecimals()
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
