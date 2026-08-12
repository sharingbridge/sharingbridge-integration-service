import { getOrderIntentListMaxRows } from "./orderIntentListMaxRows.js";
import { isCoordinatorApiRole } from "./orderIntentViews.js";
import {
  gisFn,
  gisPointFromParams
} from "./geoSql.js";

const BASE_COLUMNS = `order_intent_id, user_id, pack_id, status, payload, created_at, updated_at,
  locality_key,
  delivered_at,
  ${gisFn("ST_Y")}(location::geometry) AS geo_lat,
  ${gisFn("ST_X")}(location::geometry) AS geo_lng`;

/** Column first, then JSONB payload — matches how filters should treat stored keys. */
function effectiveLocalityKeySql() {
  return `COALESCE(
    NULLIF(TRIM(locality_key), ''),
    NULLIF(TRIM(payload->>'locality_key'), '')
  )`;
}

/**
 * @param {{ nearLat: number, nearLng: number, lngParam: string, latParam: string }} viewerNear
 */
function distanceMetresSelect(viewerNear) {
  const { lngParam, latParam } = viewerNear;
  const viewerPoint = gisPointFromParams(
    `${lngParam}::double precision`,
    `${latParam}::double precision`
  );
  return `CASE
    WHEN location IS NOT NULL THEN ROUND(
      ${gisFn("ST_Distance")}(
        location,
        ${viewerPoint}
      )::numeric
    )::integer
    ELSE NULL
  END AS distance_m`;
}

/**
 * @param {{
 *   userIdFilter?: string | null,
 *   sinceMs?: number | null,
 *   neighbourhoodScope?: { type: "near", nearLat: number, nearLng: number, radiusM: number } | { type: "locality", localityKey: string } | null,
 *   viewerUserId?: string,
 *   role?: string,
 *   maxRows?: number
 * }} opts
 * @returns {{ text: string, values: unknown[] }}
 */
export function buildOrderIntentListSql(opts) {
  const {
    userIdFilter = null,
    sinceMs = null,
    neighbourhoodScope = null,
    viewerUserId = "",
    role = "",
    maxRows = getOrderIntentListMaxRows()
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
  /** @type {string | null} */
  let nearLngParam = null;
  /** @type {string | null} */
  let nearLatParam = null;

  if (!neighbourhoodScope) {
    if (!isCoordinator && viewer) {
      where.push(`user_id = ${add(viewer)}`);
    }
  } else if (neighbourhoodScope.type === "near") {
    nearLngParam = add(neighbourhoodScope.nearLng);
    nearLatParam = add(neighbourhoodScope.nearLat);
    const radiusParam = add(neighbourhoodScope.radiusM);
    const viewerPoint = gisPointFromParams(nearLngParam, nearLatParam);
    const withinRadius = `(
      location IS NOT NULL
      AND ${gisFn("ST_DWithin")}(location, ${viewerPoint}, ${radiusParam})
    )`;
    if (!isCoordinator && viewer) {
      where.push(`(user_id = ${add(viewer)} OR ${withinRadius})`);
    } else {
      where.push(withinRadius);
    }
  } else if (neighbourhoodScope.type === "locality") {
    const keyParam = add(neighbourhoodScope.localityKey);
    const prefixParam = add(`${neighbourhoodScope.localityKey}:%`);
    const effectiveKey = effectiveLocalityKeySql();
    const localityMatch = `(
      ${effectiveKey} IS NOT NULL
      AND (
        ${effectiveKey} = ${keyParam}
        OR ${effectiveKey} LIKE ${prefixParam}
      )
    )`;
    if (!isCoordinator && viewer) {
      where.push(`(user_id = ${add(viewer)} OR ${localityMatch})`);
    } else {
      where.push(localityMatch);
    }
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  let listColumns = `${BASE_COLUMNS}, NULL::integer AS distance_m`;
  let orderBy = "updated_at DESC";

  if (neighbourhoodScope?.type === "near" && nearLngParam && nearLatParam) {
    listColumns = `${BASE_COLUMNS}, ${distanceMetresSelect({
      lngParam: nearLngParam,
      latParam: nearLatParam
    })}`;
    orderBy = "distance_m ASC NULLS LAST, updated_at DESC";
  }

  const limitParam = add(maxRows);

  return {
    text: `SELECT ${listColumns}
           FROM order_intents
           ${whereSql}
           ORDER BY ${orderBy}
           LIMIT ${limitParam}`,
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
