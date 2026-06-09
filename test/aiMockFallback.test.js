import test from "node:test";
import assert from "node:assert/strict";
import {
  AiServiceUnavailableError,
  isAiMockFallbackEnabled
} from "../src/aiMockFallback.js";
import { resolveSuggestVendorsResponse } from "../src/suggestVendors.js";

test("isAiMockFallbackEnabled defaults to false", () => {
  assert.equal(isAiMockFallbackEnabled({}), false);
  assert.equal(isAiMockFallbackEnabled({ AI_MOCK_FALLBACK_ENABLED: "" }), false);
  assert.equal(isAiMockFallbackEnabled({ AI_MOCK_FALLBACK_ENABLED: "true" }), true);
});

test("resolveSuggestVendorsResponse throws when mock fallback disabled", async () => {
  const originalUrl = process.env.AI_ORCHESTRATION_BASE_URL;
  const originalFallback = process.env.AI_MOCK_FALLBACK_ENABLED;
  delete process.env.AI_ORCHESTRATION_BASE_URL;
  process.env.AI_SUGGEST_VENDORS_ENABLED = "true";
  delete process.env.AI_MOCK_FALLBACK_ENABLED;

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
  if (originalFallback !== undefined) {
    process.env.AI_MOCK_FALLBACK_ENABLED = originalFallback;
  } else {
    delete process.env.AI_MOCK_FALLBACK_ENABLED;
  }
});
