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

test("notifyConnectionReady sends webhook secret header when configured", async () => {
  const prevUrl = process.env.CONNECTION_NOTIFY_WEBHOOK_URL;
  const prevSecret = process.env.CONNECTION_NOTIFY_WEBHOOK_SECRET;
  process.env.CONNECTION_NOTIFY_WEBHOOK_URL = "http://notify.test/hook";
  process.env.CONNECTION_NOTIFY_WEBHOOK_SECRET = "test-secret";

  let capturedHeaders = null;
  const { notifyConnectionReady } = await import("../src/connectionNotifier.js");
  await notifyConnectionReady({
    orderCode: "SB-7K2M-9F3",
    recipientUserIds: ["alice"],
    lookupEmails: async () => ({ alice: "alice@example.com" }),
    fetchImpl: async (_url, init) => {
      capturedHeaders = init.headers;
      return { ok: true };
    }
  });

  assert.equal(capturedHeaders["x-webhook-secret"], "test-secret");

  if (prevUrl == null) {
    delete process.env.CONNECTION_NOTIFY_WEBHOOK_URL;
  } else {
    process.env.CONNECTION_NOTIFY_WEBHOOK_URL = prevUrl;
  }
  if (prevSecret == null) {
    delete process.env.CONNECTION_NOTIFY_WEBHOOK_SECRET;
  } else {
    process.env.CONNECTION_NOTIFY_WEBHOOK_SECRET = prevSecret;
  }
});
