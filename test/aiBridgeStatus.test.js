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

test("resolveSuggestVendorsResponse logs mock reason when orchestration URL unset", async () => {
  const original = process.env.AI_ORCHESTRATION_BASE_URL;
  delete process.env.AI_ORCHESTRATION_BASE_URL;
  process.env.AI_SUGGEST_VENDORS_ENABLED = "true";

  const warnings = [];
  const result = await resolveSuggestVendorsResponse(
    { manual_area: "Chennai" },
    {
      aiClient: { isConfigured: () => true },
      log: { warn: (line) => warnings.push(line) }
    }
  );

  if (original !== undefined) {
    process.env.AI_ORCHESTRATION_BASE_URL = original;
  }

  assert.equal(result.source, "mock");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /AI_ORCHESTRATION_BASE_URL is unset/);
});
