import pg from "pg";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export class PostgresDeviceTokenStore {
  constructor(pool, { enabled = true } = {}) {
    this.pool = pool;
    this.enabled = enabled;
  }

  static async create(connectionString) {
    if (!isNonEmptyString(connectionString)) {
      throw new Error("DATABASE_URL is required for PostgresDeviceTokenStore.");
    }
    const pool = new pg.Pool({ connectionString: connectionString.trim() });
    const client = await pool.connect();
    let enabled = true;
    try {
      await client.query("SELECT 1");
      await client.query("SELECT 1 FROM device_tokens LIMIT 1");
    } catch (error) {
      if (error?.code === "42P01") {
        enabled = false;
      } else {
        throw error;
      }
    } finally {
      client.release();
    }
    return new PostgresDeviceTokenStore(pool, { enabled });
  }

  unavailableError() {
    const error = new Error(
      "device_tokens table is not present. Run schema-device-tokens-migration.sql."
    );
    error.status = 503;
    error.code = "device_tokens_schema_missing";
    return error;
  }

  async upsertForUser(userId, record) {
    if (!this.enabled) {
      throw this.unavailableError();
    }
    await this.pool.query(
      `INSERT INTO device_tokens (user_id, fcm_token, platform, updated_at)
       VALUES ($1, $2, $3, $4::timestamptz)
       ON CONFLICT (user_id, fcm_token) DO UPDATE SET
         platform = EXCLUDED.platform,
         updated_at = EXCLUDED.updated_at`,
      [userId, record.fcm_token, record.platform, record.updated_at]
    );
    return record;
  }

  async listTokensForUserIds(userIds) {
    if (!this.enabled || !Array.isArray(userIds) || userIds.length === 0) {
      return [];
    }
    const unique = [
      ...new Set(
        userIds
          .map((id) => (typeof id === "string" ? id.trim() : ""))
          .filter(Boolean)
      )
    ];
    if (unique.length === 0) {
      return [];
    }
    const result = await this.pool.query(
      `SELECT user_id, fcm_token, platform, updated_at
       FROM device_tokens
       WHERE user_id = ANY($1::text[])`,
      [unique]
    );
    return result.rows;
  }
}
