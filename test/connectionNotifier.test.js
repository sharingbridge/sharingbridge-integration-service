import test from "node:test";
import assert from "node:assert/strict";
import { buildConnectionReadyEmail } from "../src/connectionNotifier.js";

test("buildConnectionReadyEmail is notification-only without payment artifacts", () => {
  const { subject, text } = buildConnectionReadyEmail("SB-7K2M-9F3");
  assert.match(subject, /SB-7K2M-9F3/);
  assert.match(text, /Open SharingBridge/);
  assert.match(text, /do not send payment links/i);
  assert.doesNotMatch(text, /mailto:/i);
});
