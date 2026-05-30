#!/usr/bin/env node
/**
 * One-time import: data/order-intents.json → PostgreSQL order_intents.
 * Usage: DATABASE_URL=... node scripts/import-order-intents-json.mjs
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, "..", "data", "order-intents.json");

function recordToPayload(record) {
  return {
    has_reference_photo: Boolean(record.has_reference_photo),
    verbal_handover_notes: record.verbal_handover_notes ?? "",
    presets_snapshot: Array.isArray(record.presets_snapshot)
      ? record.presets_snapshot
      : [],
    selected_preset:
      record.selected_preset && typeof record.selected_preset === "object"
        ? record.selected_preset
        : null
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }
  let byUser = {};
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf-8"));
    byUser = parsed?.byUser && typeof parsed.byUser === "object" ? parsed.byUser : {};
  } catch (error) {
    if (error.code === "ENOENT") {
      console.warn("No order-intents.json — nothing to import.");
      process.exit(0);
    }
    throw error;
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const deduped = new Map();

  for (const [userId, list] of Object.entries(byUser)) {
    if (!Array.isArray(list)) {
      continue;
    }
    for (const record of list) {
      const packId =
        typeof record?.pack_id === "string" ? record.pack_id.trim() : "";
      if (!packId || !record?.id) {
        continue;
      }
      const key = `${userId}::${packId}`;
      const existing = deduped.get(key);
      const candidateUpdated = record.updated_at || record.created_at || "";
      if (
        !existing ||
        String(candidateUpdated) > String(existing.updated_at || existing.created_at || "")
      ) {
        deduped.set(key, { ...record, user_id: userId });
      }
    }
  }

  for (const record of deduped.values()) {
    const payload = recordToPayload(record);
    await pool.query(
      `INSERT INTO order_intents (
         order_intent_id, user_id, pack_id, status, payload, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::timestamptz, $7::timestamptz)
       ON CONFLICT (user_id, pack_id) DO UPDATE SET
         order_intent_id = EXCLUDED.order_intent_id,
         status = EXCLUDED.status,
         payload = EXCLUDED.payload,
         updated_at = EXCLUDED.updated_at`,
      [
        record.id,
        record.user_id,
        record.pack_id,
        record.status || "instructions_copied",
        JSON.stringify(payload),
        record.created_at || new Date().toISOString(),
        record.updated_at || record.created_at || new Date().toISOString()
      ]
    );
  }

  await pool.end();
  console.log(`Imported ${deduped.size} order intent(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
