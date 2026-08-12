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

test("passthrough response echoes query_text with a vendor search url", () => {
  const response = buildSuggestVendorsResponse({
    query_text: "my tiffin stall",
    manual_area: "Chennai"
  });
  assert.equal(response.source, "passthrough");
  assert.equal(response.suggestions.length, 1);
  assert.equal(response.suggestions[0].restaurant_name, "my tiffin stall");
  assert.ok(typeof response.generated_at === "string");
  assert.match(response.suggestions[0].order_url, /zomato\.com|swiggy\.com|google\.com/);
});

test("unit-test fixture catalog is not used by passthrough", async () => {
  const { MOCK_VENDOR_CATALOG } = await import("./fixtures/mockVendorCatalog.js");
  const response = buildSuggestVendorsResponse({
    query_text: "anything user typed"
  });
  const fixtureNames = new Set(
    MOCK_VENDOR_CATALOG.map((row) => row.restaurant_name)
  );
  assert.equal(fixtureNames.has(response.suggestions[0].restaurant_name), false);
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
