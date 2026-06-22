#!/usr/bin/env node
/**
 * Derive postal locality_key (IN:TN:PIN) for rows that have GPS but no key yet.
 * Updates order_intents.locality_key and seeker_demands.locality_key columns.
 *
 * Usage: DATABASE_URL=... node scripts/backfill-locality-keys-from-gps.mjs
 * Respects Nominatim rate limits (~1 req/s).
 */
import "dotenv/config";
import pg from "pg";
import { derivePostalLocalityKey } from "../src/postalGeocode.js";

const SLEEP_MS = 1100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function backfillTable(pool, table, idColumn) {
  const { rows } = await pool.query(
    `SELECT ${idColumn},
            ST_Y(location::geometry) AS lat,
            ST_X(location::geometry) AS lng
     FROM ${table}
     WHERE location IS NOT NULL
       AND COALESCE(NULLIF(TRIM(locality_key), ''), NULLIF(TRIM(payload->>'locality_key'), '')) IS NULL`
  );

  let updated = 0;
  for (const row of rows) {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }
    const localityKey = await derivePostalLocalityKey(lat, lng);
    await sleep(SLEEP_MS);
    if (!localityKey) {
      console.warn(`No postal key for ${table} ${row[idColumn]} (${lat}, ${lng})`);
      continue;
    }
    await pool.query(
      `UPDATE ${table}
       SET locality_key = $2,
           payload = jsonb_set(
             COALESCE(payload, '{}'::jsonb),
             '{locality_key}',
             to_jsonb($2::text),
             true
           ),
           updated_at = NOW()
       WHERE ${idColumn} = $1`,
      [row[idColumn], localityKey]
    );
    updated += 1;
    console.log(`${table} ${row[idColumn]} → ${localityKey}`);
  }
  return updated;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const intents = await backfillTable(pool, "order_intents", "order_intent_id");
    const demands = await backfillTable(pool, "seeker_demands", "seeker_demand_id");
    console.log(
      `Done. Updated ${intents} order intent(s) and ${demands} seeker demand(s).`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
