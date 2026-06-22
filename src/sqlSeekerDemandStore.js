import pg from "pg";
import {
  applyLocationToRecord,
  locationFromPayload
} from "./orderIntentLocation.js";
import { geoColumnsFromRecord } from "./orderIntentGeoSql.js";
import { locationSqlFragment, gisFn } from "./geoSql.js";
import { probeEcoKitchenPhase3 } from "./ecoKitchenPhase3.js";
import { isValidOrderCode } from "./orderCode.js";

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
    order_code: row.order_code ?? null,
    initiation_route: row.initiation_route ?? "eco_kitchen_pledge",
    initiator_email_share_consent_at:
      row.initiator_email_share_consent_at instanceof Date
        ? row.initiator_email_share_consent_at.toISOString()
        : row.initiator_email_share_consent_at ?? null,
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
        : String(row.updated_at),
    delivered_at:
      row.delivered_at instanceof Date
        ? row.delivered_at.toISOString()
        : row.delivered_at ?? null
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

export class SqlSeekerDemandStore {
  constructor(pool, { enabled = true, phase3 = null } = {}) {
    this.pool = pool;
    this.enabled = enabled;
    this.phase3 = phase3 ?? {
      orderCodes: false,
      pledgeConsent: false,
      kitchenCommitment: false,
      deliveryTimestamp: false
    };
  }

  static async create(connectionString) {
    if (!isNonEmptyString(connectionString)) {
      throw new Error("DATABASE_URL is required for SqlSeekerDemandStore.");
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
    const phase3 = enabled ? await probeEcoKitchenPhase3(pool) : null;
    return new SqlSeekerDemandStore(pool, { enabled, phase3 });
  }

  async init() {}

  unavailableError() {
    const error = new Error(
      "seeker_demands table is not present."
    );
    error.status = 503;
    error.code = "seeker_demand_schema_missing";
    return error;
  }

  async insertForReporter(reportedByUserId, record) {
    if (!this.enabled) {
      throw this.unavailableError();
    }
    let withLocation = record;
    if (!record.locality_key?.trim()) {
      withLocation = applyLocationToRecord(
        record,
        await locationFromPayload({
          location_lat: record.location_lat,
          location_lng: record.location_lng,
          location_label: record.location_label,
          locality_key: record.locality_key
        })
      );
    }
    const payload = recordToPayload(withLocation);
    const { localityKey, lng, lat } = geoColumnsFromRecord(withLocation);
    const lngParam = this.phase3?.orderCodes ? "$12" : "$9";
    const latParam = this.phase3?.orderCodes ? "$13" : "$10";
    if (this.phase3?.orderCodes) {
      await this.pool.query(
        `INSERT INTO seeker_demands (
           seeker_demand_id, reported_by_user_id, status, meal_units, payload,
           locality_key, location, created_at, updated_at,
           order_code, initiation_route, initiator_email_share_consent_at
         ) VALUES (
           $1, $2, $3, $4, $5::jsonb, $6, ${locationSqlFragment(lngParam, latParam)}, $7, $8,
           $9, $10, $11::timestamptz
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
          withLocation.order_code ?? null,
          withLocation.initiation_route ?? "eco_kitchen_pledge",
          withLocation.initiator_email_share_consent_at ?? null,
          lng,
          lat
        ]
      );
    } else {
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
    }
    return withLocation;
  }

  selectColumnFragments() {
    const phaseCols = this.phase3?.orderCodes
      ? `, order_code, initiation_route, initiator_email_share_consent_at`
      : `, NULL::text AS order_code, 'eco_kitchen_pledge'::text AS initiation_route,
         NULL::timestamptz AS initiator_email_share_consent_at`;
    const deliveredCol = this.phase3?.deliveryTimestamp
      ? `, delivered_at`
      : `, NULL::timestamptz AS delivered_at`;
    return { phaseCols, deliveredCol };
  }

  async findByOrderCode(orderCode) {
    if (!this.enabled || !this.phase3?.orderCodes || !isValidOrderCode(orderCode)) {
      return null;
    }
    const { phaseCols, deliveredCol } = this.selectColumnFragments();
    const result = await this.pool.query(
      `SELECT seeker_demand_id, reported_by_user_id, status, meal_units, payload,
              locality_key, created_at, updated_at${phaseCols}${deliveredCol},
              NULL::double precision AS geo_lat, NULL::double precision AS geo_lng
       FROM seeker_demands
       WHERE order_code = $1
       LIMIT 1`,
      [orderCode]
    );
    return result.rowCount > 0 ? rowToRecord(result.rows[0]) : null;
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
    const { phaseCols, deliveredCol } = this.selectColumnFragments();
    const geoSql = `SELECT seeker_demand_id, reported_by_user_id, status, meal_units, payload,
              locality_key, created_at, updated_at${phaseCols}${deliveredCol},
              ${gisFn("ST_Y")}(location::geometry) AS geo_lat,
              ${gisFn("ST_X")}(location::geometry) AS geo_lng
       FROM seeker_demands
       ${where}
       ORDER BY updated_at DESC
       LIMIT $1`;
    const plainSql = `SELECT seeker_demand_id, reported_by_user_id, status, meal_units, payload,
              locality_key, created_at, updated_at${phaseCols}${deliveredCol},
              NULL::double precision AS geo_lat,
              NULL::double precision AS geo_lng
       FROM seeker_demands
       ${where}
       ORDER BY updated_at DESC
       LIMIT $1`;
    let result;
    try {
      result = await this.pool.query(geoSql, params);
    } catch (error) {
      if (error?.code !== "42883" && error?.code !== "42704") {
        throw error;
      }
      result = await this.pool.query(plainSql, params);
    }
    return result.rows.map(rowToRecord);
  }

  async findById(seekerDemandId) {
    if (!this.enabled || !isNonEmptyString(seekerDemandId)) {
      return null;
    }
    const { phaseCols, deliveredCol } = this.selectColumnFragments();
    const result = await this.pool.query(
      `SELECT seeker_demand_id, reported_by_user_id, status, meal_units, payload,
              locality_key, created_at, updated_at${phaseCols}${deliveredCol},
              NULL::double precision AS geo_lat, NULL::double precision AS geo_lng
       FROM seeker_demands
       WHERE seeker_demand_id = $1
       LIMIT 1`,
      [seekerDemandId.trim()]
    );
    return result.rowCount > 0 ? rowToRecord(result.rows[0]) : null;
  }

  async updateByCoordinator(seekerDemandId, record) {
    if (!this.enabled) {
      throw this.unavailableError();
    }
    const id = String(seekerDemandId ?? "").trim();
    if (!id) {
      return null;
    }
    if (this.phase3?.deliveryTimestamp) {
      const result = await this.pool.query(
        `UPDATE seeker_demands
         SET status = $2,
             updated_at = $3::timestamptz,
             delivered_at = $4::timestamptz
         WHERE seeker_demand_id = $1
         RETURNING seeker_demand_id`,
        [
          id,
          record.status,
          record.updated_at,
          record.delivered_at ?? null
        ]
      );
      return result.rowCount > 0 ? this.findById(id) : null;
    }
    const result = await this.pool.query(
      `UPDATE seeker_demands
       SET status = $2,
           updated_at = $3::timestamptz
       WHERE seeker_demand_id = $1
       RETURNING seeker_demand_id`,
      [id, record.status, record.updated_at]
    );
    return result.rowCount > 0 ? this.findById(id) : null;
  }
}
