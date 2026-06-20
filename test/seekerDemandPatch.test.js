import assert from "node:assert/strict";
import test from "node:test";
import { applySeekerDemandPatch } from "../src/seekerDemandPatch.js";

const now = new Date("2026-06-02T12:00:00.000Z");

test("coordinator delivery patch marks seeker demand fulfilled", () => {
  const patched = applySeekerDemandPatch(
    {
      id: "sd-1",
      status: "recorded",
      updated_at: "2026-06-01T10:00:00.000Z"
    },
    { delivery_status: "delivered" },
    { coordinator: true, now }
  );
  assert.equal(patched.status, "fulfilled");
  assert.equal(patched.delivered_at, now.toISOString());
});

test("non-coordinator cannot patch seeker demand delivery", () => {
  assert.throws(
    () =>
      applySeekerDemandPatch(
        { id: "sd-1", status: "recorded" },
        { delivery_status: "delivered" },
        { coordinator: false, now }
      ),
    /Only coordinators/
  );
});
