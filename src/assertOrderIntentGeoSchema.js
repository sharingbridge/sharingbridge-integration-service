const SCHEMA_HINT =
  "Run sharingbridge/configuration/schema.sql (new DB), schema-postgis-migration.sql (geo), and schema-delivered-at-migration.sql (delivered_at), then restart integration-service.";

/**
 * Fail fast at startup if PostGIS geo columns are missing.
 * @param {import("pg").Pool} pool
 */
export async function assertOrderIntentGeoSchema(pool) {
  const columnCheck = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'order_intents'
       AND column_name = 'location'
     LIMIT 1`
  );
  if (columnCheck.rowCount === 0) {
    throw new Error(
      `order_intents.location column is required. ${SCHEMA_HINT}`
    );
  }

  const deliveredCheck = await pool.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'order_intents'
       AND column_name = 'delivered_at'
     LIMIT 1`
  );
  if (deliveredCheck.rowCount === 0) {
    throw new Error(
      `order_intents.delivered_at column is required. ${SCHEMA_HINT}`
    );
  }

  try {
    await pool.query(
      `SELECT ST_DWithin(
         ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography,
         ST_SetSRID(ST_MakePoint(0, 0), 4326)::geography,
         1
       )`
    );
  } catch (error) {
    throw new Error(
      `PostGIS is required for order intent geo queries (${error?.message || "unknown error"}). ${SCHEMA_HINT}`
    );
  }
}
