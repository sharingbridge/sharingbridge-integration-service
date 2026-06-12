import test from "node:test";
import assert from "node:assert/strict";
import { enrichDemandWindowsWithSupply } from "../src/marketplace.js";
import { FIXTURE_LOCALITY_POSTAL } from "./fixtures/standardOffersCatalog.js";

test("enrichDemandWindowsWithSupply computes pledge and bid gaps per offer", () => {
  const windows = [
    {
      bucket_key: `${FIXTURE_LOCALITY_POSTAL}::so-lunch-full`,
      locality_key: FIXTURE_LOCALITY_POSTAL,
      standard_offer_id: "so-lunch-full",
      menu_label: "Full course lunch (veg meals)",
      demand_count: 2,
      meal_units_total: 10,
      latest_at: "2026-06-10T12:00:00.000Z"
    },
    {
      bucket_key: "unknown::legacy",
      locality_key: "unknown",
      standard_offer_id: null,
      demand_count: 1,
      meal_units_total: 3,
      latest_at: "2026-06-10T11:00:00.000Z"
    }
  ];
  const pledges = [
    {
      pledge_id: "pl-1",
      locality_key: FIXTURE_LOCALITY_POSTAL,
      standard_offer_id: "so-lunch-full",
      meal_units: 4,
      status: "pledged",
      created_at: "2026-06-10T12:01:00.000Z"
    }
  ];
  const vendorBids = [
    {
      vendor_bid_id: "vb-1",
      locality_key: FIXTURE_LOCALITY_POSTAL,
      standard_offer_id: "so-lunch-full",
      vendor_name: "Kitchen A",
      portions: 8,
      status: "submitted",
      created_at: "2026-06-10T12:02:00.000Z"
    }
  ];

  const enriched = enrichDemandWindowsWithSupply(windows, pledges, vendorBids);
  assert.equal(enriched[0].pledged_units_total, 4);
  assert.equal(enriched[0].bid_portions_total, 8);
  assert.equal(enriched[0].unmet_demand_units, 6);
  assert.equal(enriched[0].supply_gap_units, 2);
  assert.equal(enriched[0].allocation_hint, "needs_pledges");
  assert.equal(enriched[1].pledged_units_total, 0);
  assert.equal(enriched[1].unmet_demand_units, 3);
});
