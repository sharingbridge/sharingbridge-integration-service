import test from "node:test";
import assert from "node:assert/strict";
import {
  AiOrchestrationClient,
  resolveInstructionPackTimeoutMs
} from "../src/aiOrchestrationClient.js";

test("resolveInstructionPackTimeoutMs defaults to 60s", () => {
  assert.equal(resolveInstructionPackTimeoutMs({}), 60000);
});

test("resolveInstructionPackTimeoutMs prefers instruction-pack override", () => {
  assert.equal(
    resolveInstructionPackTimeoutMs({
      AI_ORCHESTRATION_TIMEOUT_MS: "15000",
      AI_ORCHESTRATION_INSTRUCTION_PACK_TIMEOUT_MS: "90000"
    }),
    90000
  );
});

test("instructionPack client stores separate timeout budget", () => {
  const client = new AiOrchestrationClient({
    baseUrl: "https://ai.example.com",
    timeoutMs: 15000,
    instructionPackTimeoutMs: 60000
  });
  assert.equal(client.timeoutMs, 15000);
  assert.equal(client.instructionPackTimeoutMs, 60000);
});
