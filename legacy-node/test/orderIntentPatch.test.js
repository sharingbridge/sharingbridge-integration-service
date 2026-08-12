import test from "node:test";
import assert from "node:assert/strict";
import {
  applyOrderIntentPatch,
  validatePatchOrderIntentRequest
} from "../src/orderIntentPatch.js";

test("validatePatchOrderIntentRequest accepts payment_status", () => {
  assert.equal(
    validatePatchOrderIntentRequest({ payment_status: "paid_externally" }),
    null
  );
});

test("donor may mark payment paid_externally", () => {
  const existing = {
    id: "oi-1",
    payment_status: "pending",
    delivery_status: "pending"
  };
  const patched = applyOrderIntentPatch(
    existing,
    { payment_status: "paid_externally" },
    { role: "donor" }
  );
  assert.equal(patched.payment_status, "paid_externally");
});

test("donor cannot set delivery_status", () => {
  assert.throws(
    () =>
      applyOrderIntentPatch(
        { id: "oi-1", delivery_status: "pending" },
        { delivery_status: "delivered" },
        { role: "donor" }
      ),
    (error) => error.code === "forbidden_patch"
  );
});

test("coordinator may mark delivered with timestamp", () => {
  const now = new Date("2026-06-05T12:00:00.000Z");
  const patched = applyOrderIntentPatch(
    { id: "oi-1", delivery_status: "pending" },
    { delivery_status: "delivered" },
    { role: "coordinator", now }
  );
  assert.equal(patched.delivery_status, "delivered");
  assert.equal(patched.delivered_at, now.toISOString());
});
