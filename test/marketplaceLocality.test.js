import test from "node:test";
import assert from "node:assert/strict";
import {
  tagMarketplaceOfferMatch,
  validateMarketplaceOfferSelection
} from "../src/marketplace.js";
import { FIXTURE_LOCALITY_POSTAL } from "./fixtures/standardOffersCatalog.js";

test("validateMarketplaceOfferSelection rejects unknown menu line", () => {
  const error = validateMarketplaceOfferSelection(
    FIXTURE_LOCALITY_POSTAL,
    "so-unknown",
    [
      {
        bucket_key: `${FIXTURE_LOCALITY_POSTAL}::so-lunch-full`,
        locality_key: FIXTURE_LOCALITY_POSTAL,
        standard_offer_id: "so-lunch-full",
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
        locality_key: FIXTURE_LOCALITY_POSTAL,
        standard_offer_id: "so-lunch-full",
        meal_units: 1
      },
      {
        pledge_id: "pl-2",
        locality_key: "IN:KA:560001",
        standard_offer_id: "so-lunch-full",
        meal_units: 5
      }
    ],
    [
      {
        bucket_key: `${FIXTURE_LOCALITY_POSTAL}::so-lunch-full`,
        locality_key: FIXTURE_LOCALITY_POSTAL,
        standard_offer_id: "so-lunch-full",
        menu_label: "Full course lunch (veg meals)",
        price_inr: 120
      }
    ]
  );
  assert.equal(tagged[0].matches_demand_bucket, true);
  assert.equal(tagged[1].matches_demand_bucket, false);
});
