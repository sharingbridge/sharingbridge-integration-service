import test from "node:test";
import assert from "node:assert/strict";
import { normalizePresetForUserService } from "../scripts/backfill-presets-to-user-service.js";

test("normalizePresetForUserService maps integration row to valid user-service preset", () => {
  const n = normalizePresetForUserService({
    id: "u1-p1",
    restaurant_name: "A2B",
    order_url: "https://x",
    menu_items: ["Meals"],
    app_name: "Zomato",
    source: "ai_suggestion",
    confidence: 0.9,
    saved_at: "2026-05-09T12:00:00.000Z"
  });
  assert.equal(n.restaurant_name, "A2B");
  assert.equal(n.source, "ai_suggestion");
});

test("fills source and numeric confidence defaults", () => {
  const n = normalizePresetForUserService({
    restaurant_name: " Cafe ",
    order_url: " https://o ",
    menu_items: ["a"],
    app_name: "Swiggy"
  });
  assert.ok(n);
  assert.equal(n.source, "migrated_from_integration_store");
  assert.equal(n.confidence, 0);
});

test("drops invalid presets", () => {
  assert.equal(normalizePresetForUserService(null), null);
  assert.equal(
    normalizePresetForUserService({ restaurant_name: "X" }),
    null
  );
});
