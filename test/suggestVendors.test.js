import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSuggestVendorsResponse,
  validateGetPresetsRequest,
  validateSavePresetsRequest,
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

test("accepts valid save presets request", () => {
  const error = validateSavePresetsRequest({
    user_id: "demo-user",
    presets: [
      {
        restaurant_name: "A2B",
        order_url: "https://example.com",
        menu_items: ["Mini Meals"],
        app_name: "Zomato"
      }
    ]
  });
  assert.equal(error, null);
});

test("rejects invalid save presets request", () => {
  const error = validateSavePresetsRequest({
    user_id: "demo-user",
    presets: [{ app_name: "Zomato" }]
  });
  assert.equal(
    error,
    "Each preset must include restaurant_name, order_url, menu_items, and app_name."
  );
});

test("rejects get presets request without user_id", () => {
  const error = validateGetPresetsRequest("");
  assert.equal(error, "user_id is required.");
});
