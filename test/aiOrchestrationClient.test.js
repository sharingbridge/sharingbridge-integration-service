import test from "node:test";
import assert from "node:assert/strict";
import {
  AiOrchestrationClient,
  AiOrchestrationError,
  resolveInstructionPackRetryMaxAttempts,
  resolveInstructionPackTimeoutMs,
  resolveOrchestrationRetryDelayMs,
  resolveSuggestVendorsTimeoutMs
} from "../src/aiOrchestrationClient.js";

test("resolveSuggestVendorsTimeoutMs defaults to 15s", () => {
  assert.equal(resolveSuggestVendorsTimeoutMs({}), 15000);
});

test("resolveSuggestVendorsTimeoutMs reads route-specific env", () => {
  assert.equal(
    resolveSuggestVendorsTimeoutMs({
      AI_ORCHESTRATION_SUGGEST_VENDORS_TIMEOUT_MS: "20000"
    }),
    20000
  );
});

test("resolveInstructionPackTimeoutMs defaults to 60s", () => {
  assert.equal(resolveInstructionPackTimeoutMs({}), 60000);
});

test("resolveInstructionPackTimeoutMs reads route-specific env", () => {
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

test("postInternal retries HTTP 429 with non-JSON then succeeds", async () => {
  let calls = 0;
  const client = new AiOrchestrationClient({
    baseUrl: "https://ai.example.com",
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: false,
          status: 429,
          text: async () => "Too Many Requests"
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({ pack_id: "p1", delivery_instructions: "ok" })
      };
    }
  });

  const result = await client.instructionPack({ verbal_handover_notes: "" });
  assert.equal(calls, 2);
  assert.equal(result.pack_id, "p1");
});

test("isRetryableOrchestrationError treats 429 invalid_json as retryable", () => {
  const error = new AiOrchestrationError("rate limited", {
    status: 429,
    code: "rate_limited"
  });
  assert.equal(AiOrchestrationClient.isRetryableOrchestrationError(error), true);
});

test("resolveInstructionPackRetryMaxAttempts defaults to 5", () => {
  assert.equal(resolveInstructionPackRetryMaxAttempts({}), 5);
});

test("resolveOrchestrationRetryDelayMs grows with attempt and caps", () => {
  const env = {
    AI_ORCHESTRATION_RETRY_BASE_DELAY_MS: "8000",
    AI_ORCHESTRATION_RETRY_MAX_DELAY_MS: "45000"
  };
  const d1 = resolveOrchestrationRetryDelayMs(1, env);
  const d6 = resolveOrchestrationRetryDelayMs(6, env);
  assert.ok(d1 >= 8000 && d1 < 9000);
  assert.ok(d6 >= 45000 && d6 < 46000);
});

test("postInternal honors maxAttempts with zero retry delay", async () => {
  let calls = 0;
  const client = new AiOrchestrationClient({
    baseUrl: "https://ai.example.com",
    fetchImpl: async () => {
      calls += 1;
      return {
        ok: false,
        status: 429,
        text: async () => "Too Many Requests"
      };
    }
  });

  await assert.rejects(
    () =>
      client.postInternal(
        "/internal/v1/llm/instruction-pack",
        { verbal_handover_notes: "" },
        { maxAttempts: 5, retryDelayMs: () => 0 }
      ),
    (error) => error instanceof AiOrchestrationError && error.status === 429
  );
  assert.equal(calls, 5);
});
