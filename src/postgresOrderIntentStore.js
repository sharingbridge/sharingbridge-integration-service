import pg from "pg";
import { assertOrderIntentGeoSchema } from "./assertOrderIntentGeoSchema.js";
import {
  buildOrderIntentListSql,
  geoColumnsFromRecord
} from "./orderIntentGeoSql.js";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function recordToPayload(record) {
  return {
    has_reference_photo: Boolean(record.has_reference_photo),
    reference_photo_artifact_id: record.reference_photo_artifact_id ?? "",
    reference_photo_view_url: record.reference_photo_view_url ?? "",
    reference_photo_thumbnail_url: record.reference_photo_thumbnail_url ?? "",
    verbal_handover_notes: record.verbal_handover_notes ?? "",
    presets_snapshot: Array.isArray(record.presets_snapshot) ? record.presets_snapshot : [],
    selected_preset:
      record.selected_preset && typeof record.selected_preset === "object"
        ? record.selected_preset
        : null,
    location_lat:
      typeof record.location_lat === "number" ? record.location_lat : null,
    location_lng:
      typeof record.location_lng === "number" ? record.location_lng : null,
    location_label:
      typeof record.location_label === "string" ? record.location_label : "",
    locality_key:
      typeof record.locality_key === "string" ? record.locality_key : ""
  };
}

function rowToRecord(row) {
  const payload =
    typeof row.payload === "object" && row.payload !== null ? row.payload : {};
  const createdAt = row.created_at;
  const updatedAt = row.updated_at;
  const payloadLat =
    typeof payload.location_lat === "number" ? payload.location_lat : null;
  const payloadLng =
    typeof payload.location_lng === "number" ? payload.location_lng : null;
  const geoLat = typeof row.geo_lat === "number" ? row.geo_lat : null;
  const geoLng = typeof row.geo_lng === "number" ? row.geo_lng : null;
  const columnKey =
    typeof row.locality_key === "string" ? row.locality_key.trim() : "";
  const payloadKey =
    typeof payload.locality_key === "string" ? payload.locality_key.trim() : "";

  return {
    id: row.order_intent_id,
    user_id: row.user_id,
    pack_id: row.pack_id,
    status: row.status,
    has_reference_photo: Boolean(payload.has_reference_photo),
    reference_photo_artifact_id: payload.reference_photo_artifact_id ?? "",
    reference_photo_view_url: payload.reference_photo_view_url ?? "",
    reference_photo_thumbnail_url: payload.reference_photo_thumbnail_url ?? "",
    verbal_handover_notes: payload.verbal_handover_notes ?? "",
    presets_snapshot: Array.isArray(payload.presets_snapshot) ? payload.presets_snapshot : [],
    selected_preset:
      payload.selected_preset && typeof payload.selected_preset === "object"
        ? payload.selected_preset
        : null,
    location_lat: payloadLat ?? geoLat,
    location_lng: payloadLng ?? geoLng,
    location_label:
      typeof payload.location_label === "string" ? payload.location_label : "",
    locality_key: payloadKey || columnKey,
    created_at: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt),
    updated_at: updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt),
    delivered_at: formatDeliveredAt(row.delivered_at),
    distance_m: parseDistanceM(row.distance_m)
  };
}

function formatDeliveredAt(value) {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseDistanceM(value) {
  if (value == null) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function locationSqlFragment(lngParam, latParam) {
  return `CASE
    WHEN ${lngParam}::double precision IS NOT NULL
     AND ${latParam}::double precision IS NOT NULL
    THEN ST_SetSRID(ST_MakePoint(${lngParam}::double precision, ${latParam}::double precision), 4326)::geography
    ELSE NULL
  END`;
}

export class PostgresOrderIntentStore {
  constructor(pool) {
    this.pool = pool;
  }

  static async create(connectionString) {
    if (!isNonEmptyString(connectionString)) {
      throw new Error("DATABASE_URL is required for PostgresOrderIntentStore.");
    }
    const pool = new pg.Pool({ connectionString: connectionString.trim() });
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      await assertOrderIntentGeoSchema(pool);
    } finally {
      client.release();
    }
    return new PostgresOrderIntentStore(pool);
  }

  async init() {}

  async persist() {}

  async findByPackId(userId, packId) {
    const normalizedPackId = typeof packId === "string" ? packId.trim() : "";
    if (!normalizedPackId) {
      return null;
    }
    const result = await this.pool.query(
      `SELECT order_intent_id, user_id, pack_id, status, payload, created_at, updated_at
       FROM order_intents
       WHERE user_id = $1 AND pack_id = $2`,
      [userId, normalizedPackId]
    );
    return result.rowCount > 0 ? rowToRecord(result.rows[0]) : null;
  }

  async findById(userId, orderIntentId) {
    const normalizedId = typeof orderIntentId === "string" ? orderIntentId.trim() : "";
    if (!normalizedId) {
      return null;
    }
    const result = await this.pool.query(
      `SELECT order_intent_id, user_id, pack_id, status, payload, created_at, updated_at
       FROM order_intents
       WHERE user_id = $1 AND order_intent_id = $2`,
      [userId, normalizedId]
    );
    return result.rowCount > 0 ? rowToRecord(result.rows[0]) : null;
  }

  async upsertForUser(userId, record) {
    const packId = typeof record?.pack_id === "string" ? record.pack_id.trim() : "";
    const existing = packId ? await this.findByPackId(userId, packId) : null;
    const payload = recordToPayload(record);
    const createdAt = existing?.created_at ?? record.created_at ?? new Date().toISOString();
    const updatedAt = record.updated_at ?? new Date().toISOString();
    const { localityKey, lng, lat } = geoColumnsFromRecord(record);

    if (existing) {
      const values = [
        userId,
        existing.pack_id,
        record.status,
        JSON.stringify(payload),
        updatedAt,
        localityKey || null,
        lng,
        lat
      ];
      const lngParam = "$7";
      const latParam = "$8";
      const result = await this.pool.query(
        `UPDATE order_intents SET
           status = $3,
           payload = $4::jsonb,
           updated_at = $5::timestamptz,
           locality_key = $6,
           location = ${locationSqlFragment(lngParam, latParam)}
         WHERE user_id = $1 AND pack_id = $2
         RETURNING order_intent_id, user_id, pack_id, status, payload, created_at, updated_at`,
        values
      );
      return { record: rowToRecord(result.rows[0]), created: false };
    }

    const values = [
      record.id,
      userId,
      packId,
      record.status,
      JSON.stringify(payload),
      createdAt,
      updatedAt,
      localityKey || null,
      lng,
      lat
    ];
    const lngParam = "$9";
    const latParam = "$10";
    const result = await this.pool.query(
      `INSERT INTO order_intents (
         order_intent_id, user_id, pack_id, status, payload, created_at, updated_at,
         locality_key, location
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz, $7::timestamptz, $8,
         ${locationSqlFragment(lngParam, latParam)})
       RETURNING order_intent_id, user_id, pack_id, status, payload, created_at, updated_at`,
      values
    );
    return { record: rowToRecord(result.rows[0]), created: true };
  }

  async listForUser(userId) {
    const result = await this.pool.query(
      `SELECT order_intent_id, user_id, pack_id, status, payload, created_at, updated_at
       FROM order_intents
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );
    return result.rows.map(rowToRecord);
  }

  async listAll({ userIdFilter = null } = {}) {
    if (userIdFilter) {
      return this.listForUser(userIdFilter);
    }
    const result = await this.pool.query(
      `SELECT order_intent_id, user_id, pack_id, status, payload, created_at, updated_at
       FROM order_intents
       ORDER BY updated_at DESC`
    );
    return result.rows.map(rowToRecord);
  }

  async listForDashboard(opts = {}) {
    const { text, values } = buildOrderIntentListSql(opts);
    const result = await this.pool.query(text, values);
    return result.rows.map(rowToRecord);
  }
}
