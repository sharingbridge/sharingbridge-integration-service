import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createIntegrationServer } from "../src/server.js";
import { LocalPreferencesRepository } from "../src/preferencesRepository.js";
import { PreferencesStore } from "../src/preferencesStore.js";
import { OrderIntentStore } from "../src/orderIntentStore.js";
import { mintAuthToken } from "../src/tokenService.js";

test("GET /v1/geocode/reverse requires auth", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-geocode-"));
  t.after(() => fs.rm(tempDir, { recursive: true, force: true }));

  const store = new PreferencesStore(path.join(tempDir, "preferences.json"));
  const repo = new LocalPreferencesRepository(store);
  await repo.init();
  const orderIntentStore = new OrderIntentStore({ dataDir: tempDir });
  await orderIntentStore.init();

  const server = createIntegrationServer({
    preferencesRepository: repo,
    orderIntentStore
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  t.after(() => server.close());

  const response = await fetch(
    `http://127.0.0.1:${port}/v1/geocode/reverse?location_lat=12.94&location_lng=80.24`
  );
  assert.equal(response.status, 401);
});

test("GET /v1/geocode/reverse validates coordinates", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-geocode-bad-"));
  t.after(() => fs.rm(tempDir, { recursive: true, force: true }));

  const store = new PreferencesStore(path.join(tempDir, "preferences.json"));
  const repo = new LocalPreferencesRepository(store);
  await repo.init();
  const orderIntentStore = new OrderIntentStore({ dataDir: tempDir });
  await orderIntentStore.init();

  const server = createIntegrationServer({
    preferencesRepository: repo,
    orderIntentStore
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  t.after(() => server.close());

  const token = mintAuthToken("alice", { role: "donor" });
  const response = await fetch(
    `http://127.0.0.1:${port}/v1/geocode/reverse?location_lat=not-a-number`,
    { headers: { authorization: `Bearer ${token}` } }
  );
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.code, "invalid_coordinates");
});
