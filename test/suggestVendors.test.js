import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSuggestVendorsResponse,
  validateDeletePresetItemRequest,
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

test("accepts request without GPS or manual_area", () => {
  const error = validateSuggestVendorsRequest({
    query_text: "swiggy idli",
    location_precision: "unspecified",
    client_platform: "flutter-ios"
  });
  assert.equal(error, null);
});

test("response includes max five suggestions with vendor search urls", () => {
  const response = buildSuggestVendorsResponse({
    manual_area: "Chennai"
  });
  assert.ok(Array.isArray(response.suggestions));
  assert.ok(response.suggestions.length <= 5);
  assert.ok(typeof response.generated_at === "string");
  const first = response.suggestions[0];
  assert.match(first.order_url, /zomato\.com|swiggy\.com/);
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

test("delete preset item requires restaurant_name and order_url", () => {
  assert.equal(
    validateDeletePresetItemRequest({}),
    "restaurant_name is required."
  );
  assert.equal(
    validateDeletePresetItemRequest({ restaurant_name: "A" }),
    "order_url is required."
  );
  assert.equal(validateDeletePresetItemRequest(null), "Request body must be a JSON object.");
  assert.equal(
    validateDeletePresetItemRequest({
      restaurant_name: "A2B",
      order_url: "https://x"
    }),
    null
  );
});
