import assert from "node:assert/strict";
import test from "node:test";
import { normalizeIntegrationApiPath } from "../src/apiPathAliases.js";

test("normalizeIntegrationApiPath maps initiator-setup to donor-setup", () => {
  assert.equal(
    normalizeIntegrationApiPath("/v1/initiator-setup/preferences?user_id=alice"),
    "/v1/donor-setup/preferences?user_id=alice"
  );
});

test("normalizeIntegrationApiPath maps order-intents list and item paths", () => {
  assert.equal(
    normalizeIntegrationApiPath("/v1/order-intents?near_lat=1"),
    "/v1/donor-seeker/order-intents?near_lat=1"
  );
  assert.equal(
    normalizeIntegrationApiPath("/v1/order-intents/oi-1"),
    "/v1/donor-seeker/order-intents/oi-1"
  );
});

test("normalizeIntegrationApiPath maps instruction-pack", () => {
  assert.equal(
    normalizeIntegrationApiPath("/v1/instruction-pack"),
    "/v1/donor-seeker/instruction-pack"
  );
});
