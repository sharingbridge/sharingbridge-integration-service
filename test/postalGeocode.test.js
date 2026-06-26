import test from "node:test";
import assert from "node:assert/strict";
import {
  formatDisplayAddressFromNominatim,
  formatLocalityKeyFromNominatim
} from "../src/postalGeocode.js";

test("formatLocalityKeyFromNominatim builds postal key", () => {
  const key = formatLocalityKeyFromNominatim({
    address: {
      country_code: "in",
      state: "Tamil Nadu",
      postcode: "600115"
    }
  });
  assert.equal(key, "IN:TN:600115");
});

test("formatDisplayAddressFromNominatim prefers display_name", () => {
  const text = formatDisplayAddressFromNominatim({
    display_name: "12 Temple Street, Chennai, Tamil Nadu, India"
  });
  assert.equal(text, "12 Temple Street, Chennai, Tamil Nadu, India");
});

test("formatDisplayAddressFromNominatim builds from address parts", () => {
  const text = formatDisplayAddressFromNominatim({
    address: {
      road: "Temple Street",
      suburb: "Adyar",
      city: "Chennai",
      postcode: "600020",
      state: "Tamil Nadu",
      country: "India"
    }
  });
  assert.match(text, /Temple Street/);
  assert.match(text, /Chennai/);
});
