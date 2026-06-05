import test from "node:test";
import assert from "node:assert/strict";
import {
  isLiveAiSource,
  logAt,
  logStartupFromIssues,
  logStartupDiagnostics,
  shouldLog
} from "../src/serviceLog.js";

test("shouldLog defaults to warn and above", () => {
  assert.equal(shouldLog("error", { LOG_LEVEL: "warn" }), true);
  assert.equal(shouldLog("warn", { LOG_LEVEL: "warn" }), true);
  assert.equal(shouldLog("info", { LOG_LEVEL: "warn" }), false);
});

test("logAt respects LOG_LEVEL=info", () => {
  const lines = [];
  logAt("info", { info: (line) => lines.push(line) }, "hello", {
    LOG_LEVEL: "info"
  });
  assert.deepEqual(lines, ["hello"]);
});

test("logStartupDiagnostics warns on misconfigured AI bridge", () => {
  const warnings = [];
  logStartupDiagnostics(
    {
      ai: {
        suggest_vendors_flag: true,
        suggest_vendors_path_active: false,
        instruction_pack_flag: false,
        instruction_pack_path_active: false,
        internal_api_key_set: false
      }
    },
    { warn: (line) => warnings.push(line) },
    { LOG_LEVEL: "warn" }
  );
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /config issues/);
});

test("isLiveAiSource recognizes groq paths", () => {
  assert.equal(isLiveAiSource("groq"), true);
  assert.equal(isLiveAiSource("groq+gemini"), true);
  assert.equal(isLiveAiSource("deterministic"), false);
});

test("logStartupFromIssues skips full config at warn level", () => {
  const lines = [];
  logStartupFromIssues(
    { service: "integration-service" },
    [],
    {
      warn: (line) => lines.push(line),
      info: (line) => lines.push(line)
    },
    { LOG_LEVEL: "warn" }
  );
  assert.equal(lines.length, 0);
});
