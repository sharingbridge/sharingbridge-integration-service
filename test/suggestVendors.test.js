import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSuggestVendorsResponse,
  validateSuggestVendorsRequest
} from "../src/suggestVendors.js";

test("accepts valid GPS-based request", () => {
  const error = validateSuggestVendorsRequest({
    query_text: "zomato meals",
    lat: 12.97,
    lng: 80.22,
    location_precision: "gps",
    client_platform: "flutter-android"
  });
  assert.equal(error, null);
});

test("rejects request without GPS or manual_area", () => {
  const error = validateSuggestVendorsRequest({
    query_text: "swiggy idli",
    location_precision: "manual_area",
    client_platform: "flutter-ios"
  });
  assert.equal(error, "Either lat/lng or manual_area is required.");
});

test("response includes max five suggestions", () => {
  const response = buildSuggestVendorsResponse();
  assert.ok(Array.isArray(response.suggestions));
  assert.ok(response.suggestions.length <= 5);
  assert.ok(typeof response.generated_at === "string");
});
