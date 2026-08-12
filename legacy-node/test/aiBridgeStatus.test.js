import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAiBridgeStatus,
  explainMockSuggestVendorsReason,
  hostFromUrl
} from "../src/aiBridgeStatus.js";
import { resolveSuggestVendorsResponse } from "../src/suggestVendors.js";

test("hostFromUrl returns host for valid URL", () => {
  assert.equal(
    hostFromUrl("https://sharingbridge-ai-orchestration.onrender.com"),
    "sharingbridge-ai-orchestration.onrender.com"
  );
});

test("buildAiBridgeStatus reports active path when env is wired", () => {
  const status = buildAiBridgeStatus({
    AI_ORCHESTRATION_BASE_URL: "https://ai.example.com",
    AI_SUGGEST_VENDORS_ENABLED: "true",
    AI_INSTRUCTION_PACK_ENABLED: "true",
    AI_ORCHESTRATION_INTERNAL_API_KEY: "secret",
    AI_ORCHESTRATION_SUGGEST_VENDORS_TIMEOUT_MS: "12000",
    AI_ORCHESTRATION_INSTRUCTION_PACK_TIMEOUT_MS: "12000"
  });
  assert.equal(status.orchestration_base_url_set, true);
  assert.equal(status.orchestration_host, "ai.example.com");
  assert.equal(status.suggest_vendors_path_active, true);
  assert.equal(status.internal_api_key_set, true);
  assert.equal(status.suggest_vendors_timeout_ms, 12000);
  assert.equal(status.instruction_pack_timeout_ms, 12000);
});

test("buildAiBridgeStatus reports per-route timeout overrides", () => {
  const status = buildAiBridgeStatus({
    AI_ORCHESTRATION_BASE_URL: "https://ai.example.com",
    AI_ORCHESTRATION_SUGGEST_VENDORS_TIMEOUT_MS: "15000",
    AI_ORCHESTRATION_INSTRUCTION_PACK_TIMEOUT_MS: "60000"
  });
  assert.equal(status.suggest_vendors_timeout_ms, 15000);
  assert.equal(status.instruction_pack_timeout_ms, 60000);
});

test("resolveSuggestVendorsResponse throws 503 when orchestration URL unset", async () => {
  const original = process.env.AI_ORCHESTRATION_BASE_URL;
  delete process.env.AI_ORCHESTRATION_BASE_URL;
  process.env.AI_SUGGEST_VENDORS_ENABLED = "true";

  const { AiServiceUnavailableError } = await import(
    "../src/aiServiceUnavailable.js"
  );

  await assert.rejects(
    () =>
      resolveSuggestVendorsResponse(
        { query_text: "user typed query", manual_area: "Chennai" },
        {
          aiClient: { isConfigured: () => true },
          log: { warn: () => {} }
        }
      ),
    (error) => {
      assert.ok(error instanceof AiServiceUnavailableError);
      assert.equal(error.status, 503);
      assert.match(error.message, /AI_ORCHESTRATION_BASE_URL is unset/);
      return true;
    }
  );

  if (original !== undefined) {
    process.env.AI_ORCHESTRATION_BASE_URL = original;
  } else {
    delete process.env.AI_ORCHESTRATION_BASE_URL;
  }
});
