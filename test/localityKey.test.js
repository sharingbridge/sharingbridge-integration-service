import test from "node:test";
import assert from "node:assert/strict";
import {
  localityKeyChain,
  offerAppliesToLocality,
  recordMatchesLocalityFilter,
  resolveStandardOffersForLocality
} from "../src/localityKey.js";
import { FIXTURE_STANDARD_OFFERS } from "./fixtures/standardOffersCatalog.js";

test("localityKeyChain returns most-specific-first ancestors", () => {
  assert.deepEqual(localityKeyChain("IN:TN:600115"), [
    "IN:TN:600115",
    "IN:TN",
    "IN"
  ]);
});

test("offerAppliesToLocality accepts state catalog for postal demand", () => {
  assert.equal(offerAppliesToLocality("IN:TN", "IN:TN:600115"), true);
  assert.equal(offerAppliesToLocality("IN:TN:600115", "IN:TN:600115"), true);
  assert.equal(offerAppliesToLocality("IN:TN:600041", "IN:TN:600115"), false);
});

test("recordMatchesLocalityFilter includes descendants of filter key", () => {
  assert.equal(recordMatchesLocalityFilter("IN:TN:600115", "IN:TN"), true);
  assert.equal(recordMatchesLocalityFilter("IN:TN", "IN:TN:600115"), false);
});

test("resolveStandardOffersForLocality prefers postal over state for same offer id", () => {
  const resolved = resolveStandardOffersForLocality(
    FIXTURE_STANDARD_OFFERS,
    "IN:TN:600115"
  );
  const lunch = resolved.find((row) => row.id === "so-lunch-full");
  const stateLunch = resolved.find((row) => row.id === "so-lunch-full-state");
  assert.ok(lunch);
  assert.equal(lunch.locality_key, "IN:TN:600115");
  assert.ok(stateLunch);
  assert.equal(stateLunch.locality_key, "IN:TN");
});
