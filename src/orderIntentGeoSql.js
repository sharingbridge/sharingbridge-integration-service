import { isCoordinatorApiRole } from "./orderIntentViews.js";

const LIST_COLUMNS = `order_intent_id, user_id, pack_id, status, payload, created_at, updated_at,
  locality_key,
  ST_Y(location::geometry) AS geo_lat,
  ST_X(location::geometry) AS geo_lng`;

/**
 * @param {{
 *   userIdFilter?: string | null,
 *   sinceMs?: number | null,
 *   neighbourhoodScope?: { type: "near", nearLat: number, nearLng: number, radiusM: number } | { type: "locality", localityKey: string } | null,
 *   viewerUserId?: string,
 *   role?: string
 * }} opts
 * @returns {{ text: string, values: unknown[] }}
 */
export function buildOrderIntentListSql(opts) {
  const {
    userIdFilter = null,
    sinceMs = null,
    neighbourhoodScope = null,
    viewerUserId = "",
    role = ""
  } = opts;

  const values = [];
  const where = [];

  const add = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (typeof userIdFilter === "string" && userIdFilter.trim()) {
    where.push(`user_id = ${add(userIdFilter.trim())}`);
  }

  if (sinceMs != null && sinceMs > 0) {
    const cutoff = new Date(Date.now() - sinceMs).toISOString();
    where.push(`updated_at >= ${add(cutoff)}::timestamptz`);
  }

  const viewer = typeof viewerUserId === "string" ? viewerUserId.trim() : "";
  const isCoordinator = isCoordinatorApiRole(role);

  if (!neighbourhoodScope) {
    if (!isCoordinator && viewer) {
      where.push(`user_id = ${add(viewer)}`);
    }
  } else if (neighbourhoodScope.type === "near") {
    const lngParam = add(neighbourhoodScope.nearLng);
    const latParam = add(neighbourhoodScope.nearLat);
    const radiusParam = add(neighbourhoodScope.radiusM);
    const viewerClause = viewer ? `user_id = ${add(viewer)}` : "FALSE";
    where.push(`(
      ${viewerClause}
      OR (
        location IS NOT NULL
        AND ST_DWithin(
          location,
          ST_SetSRID(ST_MakePoint(${lngParam}, ${latParam}), 4326)::geography,
          ${radiusParam}
        )
      )
    )`);
  } else if (neighbourhoodScope.type === "locality") {
    const keyParam = add(neighbourhoodScope.localityKey);
    const viewerClause = viewer ? `user_id = ${add(viewer)}` : "FALSE";
    where.push(`(
      ${viewerClause}
      OR (
        location IS NOT NULL
        AND locality_key IS NOT NULL
        AND locality_key <> ''
        AND locality_key = ${keyParam}
      )
    )`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  return {
    text: `SELECT ${LIST_COLUMNS}
           FROM order_intents
           ${whereSql}
           ORDER BY updated_at DESC`,
    values
  };
}

/**
 * @param {object} record
 * @returns {{ localityKey: string, lng: number | null, lat: number | null }}
 */
export function geoColumnsFromRecord(record) {
  const localityKey =
    typeof record?.locality_key === "string" ? record.locality_key.trim() : "";
  const lat = record?.location_lat;
  const lng = record?.location_lng;
  if (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    return { localityKey, lng, lat };
  }
  return { localityKey, lng: null, lat: null };
}
