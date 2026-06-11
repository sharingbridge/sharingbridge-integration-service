import assert from "node:assert/strict";
import test from "node:test";
import { getDonorNeighbourhoodWindowMs } from "../src/donorNeighbourhoodWindow.js";
import {
  formatOrderIntentCoordinator,
  formatOrderIntentForRole,
  formatOrderIntentLimited
} from "../src/orderIntentViews.js";

const now = Date.parse("2026-06-02T12:00:00.000Z");

function recordWithPhoto(ageMs, userId = "alice") {
  return {
    id: "oi-1",
    user_id: userId,
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

test("formatOrderIntentLimited strips photo URLs outside neighbourhood window", () => {
  const windowMs = getDonorNeighbourhoodWindowMs();
  const old = recordWithPhoto(windowMs + 1000);
  const formatted = formatOrderIntentLimited(old, now);
  assert.equal(formatted.has_reference_photo, false);
  assert.equal(formatted.reference_photo_view_url, "");
  assert.equal(formatted.reference_photo_thumbnail_url, "");
});

test("formatOrderIntentLimited keeps photo URLs within neighbourhood window", () => {
  const recent = recordWithPhoto(30 * 60 * 1000);
  const formatted = formatOrderIntentLimited(recent, now);
  assert.equal(formatted.reference_photo_view_url, "https://cdn/view");
  assert.equal(formatted.reference_photo_thumbnail_url, "https://cdn/thumb");
});

test("formatOrderIntentForRole uses full view for coordinator", () => {
  const old = recordWithPhoto(getDonorNeighbourhoodWindowMs() + 1000);
  const formatted = formatOrderIntentForRole(old, "coordinator", { nowMs: now });
  assert.equal(formatted.reference_photo_view_url, "https://cdn/view");
});

test("formatOrderIntentCoordinator includes donor_email when known", () => {
  const formatted = formatOrderIntentCoordinator(
    recordWithPhoto(0),
    { alice: "alice@example.com" },
    now
  );
  assert.equal(formatted.user_id, "alice");
  assert.equal(formatted.donor_email, "alice@example.com");
  assert.equal(formatted.initiator_email, "alice@example.com");
});

test("formatOrderIntentLimited omits donor_email", () => {
  const formatted = formatOrderIntentLimited(recordWithPhoto(0), now);
  assert.equal("donor_email" in formatted, false);
});

test("formatOrderIntentLimited keeps coordinates for viewer own intent", () => {
  const formatted = formatOrderIntentLimited(
    {
      ...recordWithPhoto(0),
      location_lat: 12.97,
      location_lng: 80.22
    },
    now,
    "alice"
  );
  assert.equal(formatted.location_lat, 12.97);
  assert.equal(formatted.location_lng, 80.22);
});

test("formatOrderIntentLimited redacts coordinates for other donors", () => {
  const formatted = formatOrderIntentLimited(
    {
      ...recordWithPhoto(0, "bob"),
      location_lat: 12.97,
      location_lng: 80.22
    },
    now,
    "alice"
  );
  assert.equal(formatted.location_lat, null);
  assert.equal(formatted.location_lng, null);
});
