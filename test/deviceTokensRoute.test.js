import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createIntegrationServer } from "../src/server.js";
import { LocalPreferencesRepository } from "../src/preferencesRepository.js";
import { PreferencesStore } from "../src/preferencesStore.js";
import { OrderIntentStore } from "../src/orderIntentStore.js";
import { InMemoryDeviceTokenStore } from "./support/inMemoryDeviceTokenStore.js";
import { mintAuthToken } from "../src/tokenService.js";

test("PUT /v1/device-tokens stores FCM token for authed user", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-device-token-"));
  t.after(() => fs.rm(tempDir, { recursive: true, force: true }));

  const store = new PreferencesStore(path.join(tempDir, "preferences.json"));
  const repo = new LocalPreferencesRepository(store);
  await repo.init();
  const orderIntentStore = new OrderIntentStore({ dataDir: tempDir });
  await orderIntentStore.init();
  const deviceTokenStore = new InMemoryDeviceTokenStore();

  const server = createIntegrationServer({
    preferencesRepository: repo,
    orderIntentStore,
    deviceTokenStore
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  t.after(() => server.close());

  const token = mintAuthToken("alice", { role: "donor" });
  const response = await fetch(`http://127.0.0.1:${port}/v1/device-tokens`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      fcm_token: "fcm-test-token-abc",
      platform: "android"
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.device_token.user_id, "alice");
  assert.equal(body.device_token.platform, "android");
  assert.equal(deviceTokenStore.rows.length, 1);
});
