import test from "node:test";
import assert from "node:assert/strict";
import {
  AiOrchestrationClient,
  resolveInstructionPackTimeoutMs,
  resolveSuggestVendorsTimeoutMs
} from "../src/aiOrchestrationClient.js";

test("resolveSuggestVendorsTimeoutMs defaults to 15s", () => {
  assert.equal(resolveSuggestVendorsTimeoutMs({}), 15000);
});

test("resolveSuggestVendorsTimeoutMs prefers route-specific name", () => {
  assert.equal(
    resolveSuggestVendorsTimeoutMs({
      AI_ORCHESTRATION_SUGGEST_VENDORS_TIMEOUT_MS: "20000",
      AI_ORCHESTRATION_TIMEOUT_MS: "9000"
    }),
    20000
  );
});

test("resolveSuggestVendorsTimeoutMs falls back to legacy AI_ORCHESTRATION_TIMEOUT_MS", () => {
  assert.equal(
    resolveSuggestVendorsTimeoutMs({
      AI_ORCHESTRATION_TIMEOUT_MS: "12000"
    }),
    12000
  );
});

test("resolveInstructionPackTimeoutMs defaults to 60s", () => {
  assert.equal(resolveInstructionPackTimeoutMs({}), 60000);
});

test("resolveInstructionPackTimeoutMs prefers instruction-pack override", () => {
  assert.equal(
    resolveInstructionPackTimeoutMs({
      AI_ORCHESTRATION_INSTRUCTION_PACK_TIMEOUT_MS: "90000"
    }),
    90000
  );
});

test("instructionPack client stores separate timeout budgets", () => {
  const client = new AiOrchestrationClient({
    baseUrl: "https://ai.example.com",
    timeoutMs: 15000,
    instructionPackTimeoutMs: 60000
  });
  assert.equal(client.timeoutMs, 15000);
  assert.equal(client.instructionPackTimeoutMs, 60000);
});
