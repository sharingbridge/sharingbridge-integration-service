import test from "node:test";
import assert from "node:assert/strict";
import { formatLocalityKeyFromNominatim } from "../src/postalGeocode.js";

test("formatLocalityKeyFromNominatim builds IN:TN:postal from Chennai sample", () => {
  const key = formatLocalityKeyFromNominatim({
    address: {
      country_code: "in",
      state: "Tamil Nadu",
      "ISO3166-2-lvl4": "IN-TN",
      postcode: "600115"
    }
  });
  assert.equal(key, "IN:TN:600115");
});

test("formatLocalityKeyFromNominatim falls back to state when postcode missing", () => {
  const key = formatLocalityKeyFromNominatim({
    address: {
      country_code: "in",
      state: "Tamil Nadu",
      "ISO3166-2-lvl4": "IN-TN"
    }
  });
  assert.equal(key, "IN:TN");
});
