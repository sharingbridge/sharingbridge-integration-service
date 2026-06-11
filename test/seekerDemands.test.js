import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateDemandByLocality,
  aggregateDemandByStandardOffer,
  buildSeekerDemandRecord,
  validateCreateSeekerDemandRequest
} from "../src/seekerDemands.js";
import { PILOT_STANDARD_OFFERS } from "../src/pilotStandardOffers.js";

test("validateCreateSeekerDemandRequest requires standard_offer_id", () => {
  assert.equal(
    validateCreateSeekerDemandRequest({ meal_units: 2 }),
    "standard_offer_id is required. Choose a standard menu item for this area."
  );
});

test("buildSeekerDemandRecord assigns id and menu from standard offer", () => {
  const offer = PILOT_STANDARD_OFFERS[2];
  const record = buildSeekerDemandRecord(
    { standard_offer_id: offer.id, meal_units: 3 },
    { reportedByUserId: "u1", standardOffer: offer }
  );
  assert.match(record.id, /^sd-/);
  assert.equal(record.meal_units, 3);
  assert.equal(record.standard_offer_id, offer.id);
  assert.equal(record.menu_label, offer.menu_label);
  assert.equal(record.need_description, offer.menu_label);
  assert.equal(record.price_inr, offer.price_inr);
  assert.equal(record.reported_by_user_id, "u1");
});

test("aggregateDemandByLocality sums meal units", () => {
  const rows = aggregateDemandByLocality([
    {
      locality_key: "IN:TN:600115",
      meal_units: 2,
      updated_at: "2026-06-06T10:00:00Z"
    },
    {
      locality_key: "IN:TN:600115",
      meal_units: 1,
      updated_at: "2026-06-06T11:00:00Z"
    }
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].meal_units_total, 3);
  assert.equal(rows[0].demand_count, 2);
});

test("aggregateDemandByStandardOffer groups by menu item", () => {
  const rows = aggregateDemandByStandardOffer([
    {
      locality_key: "IN:TN:600115",
      standard_offer_id: "so-lunch-full",
      menu_label: "Full course lunch (veg meals)",
      price_inr: 120,
      meal_units: 2,
      updated_at: "2026-06-06T10:00:00Z"
    },
    {
      locality_key: "IN:TN:600115",
      standard_offer_id: "so-dinner-light",
      menu_label: "Light dinner (chapati / rice portion)",
      price_inr: 55,
      meal_units: 1,
      updated_at: "2026-06-06T11:00:00Z"
    }
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].meal_units_total, 2);
  assert.equal(rows[1].meal_units_total, 1);
});
