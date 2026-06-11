import pg from "pg";
import {
  applyLocationToRecord,
  locationFromPayload
} from "./orderIntentLocation.js";
import { geoColumnsFromRecord } from "./orderIntentGeoSql.js";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function rowToRecord(row) {
  const payload =
    typeof row.payload === "object" && row.payload !== null ? row.payload : {};
  const geoLat = typeof row.geo_lat === "number" ? row.geo_lat : null;
  const geoLng = typeof row.geo_lng === "number" ? row.geo_lng : null;
  const payloadLat =
    typeof payload.location_lat === "number" ? payload.location_lat : null;
  const payloadLng =
    typeof payload.location_lng === "number" ? payload.location_lng : null;

  return {
    id: row.seeker_demand_id,
    reported_by_user_id: row.reported_by_user_id,
    status: row.status,
    meal_units: Number(row.meal_units) || 1,
    need_description: String(payload.need_description ?? ""),
    standard_offer_id: String(payload.standard_offer_id ?? "").trim() || null,
    menu_label: String(payload.menu_label ?? payload.need_description ?? ""),
    price_inr:
      typeof payload.price_inr === "number" ? payload.price_inr : null,
    verbal_notes: String(payload.verbal_notes ?? ""),
    location_lat: payloadLat ?? geoLat,
    location_lng: payloadLng ?? geoLng,
    location_label: String(payload.location_label ?? ""),
    locality_key:
      (typeof row.locality_key === "string" ? row.locality_key.trim() : "") ||
      String(payload.locality_key ?? ""),
    created_at:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updated_at:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at)
  };
}

function recordToPayload(record) {
  return {
    need_description: record.need_description,
    standard_offer_id: record.standard_offer_id ?? null,
    menu_label: record.menu_label ?? record.need_description ?? "",
    price_inr:
      typeof record.price_inr === "number" ? record.price_inr : null,
    verbal_notes: record.verbal_notes ?? "",
    location_lat:
      typeof record.location_lat === "number" ? record.location_lat : null,
    location_lng:
      typeof record.location_lng === "number" ? record.location_lng : null,
    location_label: record.location_label ?? "",
    locality_key: record.locality_key ?? ""
  };
}

function locationSqlFragment(lngParam, latParam) {
  return `CASE
    WHEN ${lngParam}::double precision IS NOT NULL
     AND ${latParam}::double precision IS NOT NULL
    THEN ST_SetSRID(ST_MakePoint(${lngParam}::double precision, ${latParam}::double precision), 4326)::geography
    ELSE NULL
  END`;
}

export class PostgresSeekerDemandStore {
  constructor(pool, { enabled = true } = {}) {
    this.pool = pool;
    this.enabled = enabled;
  }

  static async create(connectionString) {
    if (!isNonEmptyString(connectionString)) {
      throw new Error("DATABASE_URL is required for PostgresSeekerDemandStore.");
    }
    const pool = new pg.Pool({ connectionString: connectionString.trim() });
    const client = await pool.connect();
    let enabled = true;
    try {
      await client.query("SELECT 1");
      await client.query("SELECT 1 FROM seeker_demands LIMIT 1");
    } catch (error) {
      if (error?.code === "42P01") {
        enabled = false;
      } else {
        throw error;
      }
    } finally {
      client.release();
    }
    return new PostgresSeekerDemandStore(pool, { enabled });
  }

  async init() {}

  unavailableError() {
    const error = new Error(
      "seeker_demands table missing. Run configuration/schema-seeker-demands-migration.sql in Supabase."
    );
    error.status = 503;
    error.code = "seeker_demand_schema_missing";
    return error;
  }

  async insertForReporter(reportedByUserId, record) {
    if (!this.enabled) {
      throw this.unavailableError();
    }
    const withLocation = applyLocationToRecord(
      record,
      locationFromPayload({
        location_lat: record.location_lat,
        location_lng: record.location_lng,
        location_label: record.location_label,
        locality_key: record.locality_key
      })
    );
    const payload = recordToPayload(withLocation);
    const { localityKey, lng, lat } = geoColumnsFromRecord(withLocation);
    const lngParam = "$9";
    const latParam = "$10";
    await this.pool.query(
      `INSERT INTO seeker_demands (
         seeker_demand_id, reported_by_user_id, status, meal_units, payload,
         locality_key, location, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5::jsonb, $6, ${locationSqlFragment(lngParam, latParam)}, $7, $8
       )`,
      [
        withLocation.id,
        reportedByUserId,
        withLocation.status,
        withLocation.meal_units,
        JSON.stringify(payload),
        localityKey || null,
        withLocation.created_at,
        withLocation.updated_at,
        lng,
        lat
      ]
    );
    return withLocation;
  }

  async listRecent({ limit = 100, reporterUserIdFilter = null } = {}) {
    if (!this.enabled) {
      return [];
    }
    const capped = Math.min(Math.max(Number(limit) || 100, 1), 200);
    const params = [capped];
    let where = "";
    if (reporterUserIdFilter) {
      params.push(reporterUserIdFilter);
      where = `WHERE reported_by_user_id = $2`;
    }
    const result = await this.pool.query(
      `SELECT seeker_demand_id, reported_by_user_id, status, meal_units, payload,
              locality_key, created_at, updated_at,
              ST_Y(location::geometry) AS geo_lat,
              ST_X(location::geometry) AS geo_lng
       FROM seeker_demands
       ${where}
       ORDER BY updated_at DESC
       LIMIT $1`,
      params
    );
    return result.rows.map(rowToRecord);
  }
}
