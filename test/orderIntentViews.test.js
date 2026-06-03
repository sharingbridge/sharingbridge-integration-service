import assert from "node:assert/strict";
import test from "node:test";
import {
  REFERENCE_PHOTO_MAX_AGE_MS,
  formatOrderIntentForRole,
  formatOrderIntentLimited
} from "../src/orderIntentViews.js";

const now = Date.parse("2026-06-02T12:00:00.000Z");

function recordWithPhoto(ageMs) {
  return {
    order_intent_id: "oi-1",
    user_id: "alice",
    pack_id: "pack-1",
    status: "instructions_copied",
    created_at: new Date(now - ageMs).toISOString(),
    updated_at: new Date(now - ageMs).toISOString(),
    has_reference_photo: true,
    reference_photo_artifact_id: "art-1",
    reference_photo_view_url: "https://cdn/view",
    reference_photo_thumbnail_url: "https://cdn/thumb",
    presets_snapshot: []
  };
}

test("formatOrderIntentLimited strips photo URLs when older than one hour", () => {
  const old = recordWithPhoto(REFERENCE_PHOTO_MAX_AGE_MS + 1000);
  const formatted = formatOrderIntentLimited(old, now);
  assert.equal(formatted.has_reference_photo, false);
  assert.equal(formatted.reference_photo_view_url, "");
  assert.equal(formatted.reference_photo_thumbnail_url, "");
});

test("formatOrderIntentLimited keeps photo URLs within one hour", () => {
  const recent = recordWithPhoto(30 * 60 * 1000);
  const formatted = formatOrderIntentLimited(recent, now);
  assert.equal(formatted.reference_photo_view_url, "https://cdn/view");
  assert.equal(formatted.reference_photo_thumbnail_url, "https://cdn/thumb");
});

test("formatOrderIntentForRole uses full view for coordinator", () => {
  const old = recordWithPhoto(REFERENCE_PHOTO_MAX_AGE_MS + 1000);
  const formatted = formatOrderIntentForRole(old, "coordinator", now);
  assert.equal(formatted.reference_photo_view_url, "https://cdn/view");
});
