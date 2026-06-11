import test from "node:test";
import assert from "node:assert/strict";
import {
  tagMarketplaceOfferMatch,
  validateMarketplaceOfferSelection
} from "../src/marketplace.js";

test("validateMarketplaceOfferSelection rejects unknown menu line", () => {
  const error = validateMarketplaceOfferSelection(
    "12.94,80.24",
    "so-unknown",
    [
      {
        bucket_key: "12.94,80.24::so-lunch-full-legacy-grid",
        locality_key: "12.94,80.24",
        standard_offer_id: "so-lunch-full-legacy-grid",
        menu_label: "Full course lunch (veg meals)",
        price_inr: 120
      }
    ]
  );
  assert.match(error ?? "", /No matching demand line/);
});

test("tagMarketplaceOfferMatch flags orphan pledges", () => {
  const tagged = tagMarketplaceOfferMatch(
    [
      {
        pledge_id: "pl-1",
        locality_key: "12.94,80.24",
        standard_offer_id: "so-lunch-full-legacy-grid",
        meal_units: 1
      },
      {
        pledge_id: "pl-2",
        locality_key: "Tambaram",
        standard_offer_id: "so-lunch-full-legacy-grid",
        meal_units: 5
      }
    ],
    [
      {
        bucket_key: "12.94,80.24::so-lunch-full-legacy-grid",
        locality_key: "12.94,80.24",
        standard_offer_id: "so-lunch-full-legacy-grid",
        menu_label: "Full course lunch (veg meals)",
        price_inr: 120
      }
    ]
  );
  assert.equal(tagged[0].matches_demand_bucket, true);
  assert.equal(tagged[1].matches_demand_bucket, false);
});
