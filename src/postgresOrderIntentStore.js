import pg from "pg";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function recordToPayload(record) {
  return {
    has_reference_photo: Boolean(record.has_reference_photo),
    verbal_handover_notes: record.verbal_handover_notes ?? "",
    presets_snapshot: Array.isArray(record.presets_snapshot) ? record.presets_snapshot : [],
    selected_preset:
      record.selected_preset && typeof record.selected_preset === "object"
        ? record.selected_preset
        : null
  };
}

function rowToRecord(row) {
  const payload =
    typeof row.payload === "object" && row.payload !== null ? row.payload : {};
  const createdAt = row.created_at;
  const updatedAt = row.updated_at;
  return {
    id: row.order_intent_id,
    user_id: row.user_id,
    pack_id: row.pack_id,
    status: row.status,
    has_reference_photo: Boolean(payload.has_reference_photo),
    verbal_handover_notes: payload.verbal_handover_notes ?? "",
    presets_snapshot: Array.isArray(payload.presets_snapshot) ? payload.presets_snapshot : [],
    selected_preset:
      payload.selected_preset && typeof payload.selected_preset === "object"
        ? payload.selected_preset
        : null,
    created_at: createdAt instanceof Date ? createdAt.toISOString() : String(createdAt),
    updated_at: updatedAt instanceof Date ? updatedAt.toISOString() : String(updatedAt)
  };
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

    if (existing) {
      const result = await this.pool.query(
        `UPDATE order_intents SET
           status = $3,
           payload = $4::jsonb,
           updated_at = $5::timestamptz
         WHERE user_id = $1 AND pack_id = $2
         RETURNING order_intent_id, user_id, pack_id, status, payload, created_at, updated_at`,
        [
          userId,
          existing.pack_id,
          record.status,
          JSON.stringify(payload),
          updatedAt
        ]
      );
      return { record: rowToRecord(result.rows[0]), created: false };
    }

    const result = await this.pool.query(
      `INSERT INTO order_intents (
         order_intent_id, user_id, pack_id, status, payload, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz, $7::timestamptz)
       RETURNING order_intent_id, user_id, pack_id, status, payload, created_at, updated_at`,
      [
        record.id,
        userId,
        packId,
        record.status,
        JSON.stringify(payload),
        createdAt,
        updatedAt
      ]
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
}
