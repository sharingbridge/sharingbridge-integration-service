const SCHEMA_HINT =
  "Run sharingbridge/configuration/schema.sql (new DB) or schema-postgis-migration.sql (existing DB), then restart integration-service.";

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
