import assert from "node:assert/strict";
import { test } from "node:test";
import { SqlOrderIntentStore } from "../src/sqlOrderIntentStore.js";

function baseRecord(overrides = {}) {
  return {
    id: "oi-test-1",
    user_id: "alice",
    pack_id: "pack-1",
    status: "instructions_copied",
    has_reference_photo: false,
    verbal_handover_notes: "",
    presets_snapshot: [],
    selected_preset: null,
    location_lat: 13.08,
    location_lng: 80.27,
    locality_key: "IN:TN:600001",
    payment_status: "paid_externally",
    delivery_status: "delivered",
    delivered_at: "2026-06-12T17:00:00.000Z",
    created_at: "2026-06-12T16:00:00.000Z",
    updated_at: "2026-06-12T17:00:00.000Z",
    ...overrides
  };
}

test("updateRecordForUser uses contiguous $1..$9 placeholders for geo", async () => {
  const existing = baseRecord({ payment_status: "pending", delivery_status: "pending" });
  let capturedSql = "";
  let capturedValues = [];

  const pool = {
    query: async (sql, values) => {
      if (sql.includes("WHERE user_id = $1 AND order_intent_id = $2")) {
        capturedSql = sql;
        capturedValues = values;
        return {
          rowCount: 1,
          rows: [
            {
              order_intent_id: existing.id,
              user_id: existing.user_id,
              pack_id: existing.pack_id,
              status: existing.status,
              payload: {
                payment_status: "paid_externally",
                delivery_status: "delivered"
              },
              created_at: existing.created_at,
              updated_at: existing.updated_at,
              delivered_at: existing.delivered_at,
              locality_key: existing.locality_key,
              geo_lat: existing.location_lat,
              geo_lng: existing.location_lng,
              distance_m: null
            }
          ]
        };
      }
      if (sql.includes("WHERE user_id = $1 AND order_intent_id = $2") === false) {
        return { rowCount: 1, rows: [existing] };
      }
      return { rowCount: 0, rows: [] };
    }
  };

  const store = new SqlOrderIntentStore(pool);
  store.findById = async () => existing;

  const saved = await store.updateRecordForUser("alice", baseRecord());
  assert.ok(saved);
  assert.equal(capturedValues.length, 9);
  assert.match(capturedSql, /\$8::double precision/);
  assert.match(capturedSql, /\$9::double precision/);
  assert.doesNotMatch(capturedSql, /\$10::double precision/);
});
