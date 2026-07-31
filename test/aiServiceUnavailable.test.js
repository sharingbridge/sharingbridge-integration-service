import test from "node:test";
import assert from "node:assert/strict";
import { AiServiceUnavailableError } from "../src/aiServiceUnavailable.js";
import { resolveSuggestVendorsResponse } from "../src/suggestVendors.js";

test("resolveSuggestVendorsResponse throws 503 when orchestration is not configured", async () => {
  const originalUrl = process.env.AI_ORCHESTRATION_BASE_URL;
  delete process.env.AI_ORCHESTRATION_BASE_URL;
  process.env.AI_SUGGEST_VENDORS_ENABLED = "true";

  await assert.rejects(
    () =>
      resolveSuggestVendorsResponse(
        { query_text: "meals", location_precision: "approximate" },
        { aiClient: { isConfigured: () => false } }
      ),
    (error) => {
      assert.ok(error instanceof AiServiceUnavailableError);
      assert.equal(error.status, 503);
      return true;
    }
  );

  if (originalUrl !== undefined) {
    process.env.AI_ORCHESTRATION_BASE_URL = originalUrl;
  }
});
