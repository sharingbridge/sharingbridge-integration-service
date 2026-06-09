import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateDemandByLocality,
  buildSeekerDemandRecord,
  validateCreateSeekerDemandRequest
} from "../src/seekerDemands.js";

test("validateCreateSeekerDemandRequest requires need_description", () => {
  assert.equal(
    validateCreateSeekerDemandRequest({ meal_units: 2 }),
    "need_description is required."
  );
});

test("buildSeekerDemandRecord assigns id and meal_units", () => {
  const record = buildSeekerDemandRecord(
    { need_description: "  Lunch meals  ", meal_units: 3 },
    { reportedByUserId: "u1" }
  );
  assert.match(record.id, /^sd-/);
  assert.equal(record.meal_units, 3);
  assert.equal(record.need_description, "Lunch meals");
  assert.equal(record.reported_by_user_id, "u1");
});

test("aggregateDemandByLocality sums meal units", () => {
  const rows = aggregateDemandByLocality([
    {
      locality_key: "12.94,80.24",
      meal_units: 2,
      updated_at: "2026-06-06T10:00:00Z"
    },
    {
      locality_key: "12.94,80.24",
      meal_units: 1,
      updated_at: "2026-06-06T11:00:00Z"
    }
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].meal_units_total, 3);
  assert.equal(rows[0].demand_count, 2);
});
