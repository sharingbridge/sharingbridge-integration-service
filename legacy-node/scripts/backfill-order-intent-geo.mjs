#!/usr/bin/env node
/**
 * Backfill order_intents.locality_key and location from payload JSONB.
 * Requires geo columns (configuration/schema.sql).
 */
import "dotenv/config";
import pg from "pg";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.join(
  __dirname,
  "../../sharingbridge/configuration/schema-postgis-migration.sql"
);

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const sql = await fs.readFile(migrationPath, "utf8");
    await pool.query(sql);
    console.log("Geo migration + backfill applied.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
