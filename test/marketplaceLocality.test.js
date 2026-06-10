import test from "node:test";
import assert from "node:assert/strict";
import {
  tagMarketplaceLocalityMatch,
  validateMarketplaceLocalityKey
} from "../src/marketplace.js";

test("validateMarketplaceLocalityKey rejects unknown place names", () => {
  const error = validateMarketplaceLocalityKey("Tambaram", [
    "12.94,80.24",
    "12.936,80.236"
  ]);
  assert.match(error ?? "", /must match an active demand bucket/);
});

test("tagMarketplaceLocalityMatch flags orphan pledges", () => {
  const tagged = tagMarketplaceLocalityMatch(
    [
      { pledge_id: "pl-1", locality_key: "12.94,80.24", meal_units: 1 },
      { pledge_id: "pl-2", locality_key: "Tambaram", meal_units: 5 }
    ],
    ["12.94,80.24"]
  );
  assert.equal(tagged[0].matches_demand_bucket, true);
  assert.equal(tagged[1].matches_demand_bucket, false);
});
