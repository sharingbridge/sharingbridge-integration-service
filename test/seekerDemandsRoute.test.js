import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createIntegrationServer } from "../src/server.js";
import { LocalPreferencesRepository } from "../src/preferencesRepository.js";
import { PreferencesStore } from "../src/preferencesStore.js";
import { OrderIntentStore } from "../src/orderIntentStore.js";
import { InMemorySeekerDemandStore } from "../src/inMemorySeekerDemandStore.js";
import { mintAuthToken } from "../src/tokenService.js";

test("POST /v1/seeker-demands records seeker demand", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-demand-"));
  t.after(() => fs.rm(tempDir, { recursive: true, force: true }));

  const store = new PreferencesStore(path.join(tempDir, "preferences.json"));
  const repo = new LocalPreferencesRepository(store);
  await repo.init();
  const orderIntentStore = new OrderIntentStore({ dataDir: tempDir });
  await orderIntentStore.init();
  const seekerDemandStore = new InMemorySeekerDemandStore();
  await seekerDemandStore.init();

  const server = createIntegrationServer({
    preferencesRepository: repo,
    orderIntentStore,
    seekerDemandStore
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  t.after(() => server.close());

  const token = mintAuthToken("alice", { role: "donor" });
  const response = await fetch(`http://127.0.0.1:${port}/v1/seeker-demands`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      need_description: "Two meals for family",
      meal_units: 2,
      location_lat: 12.94,
      location_lng: 80.24
    })
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.created, true);
  assert.match(body.seeker_demand.seeker_demand_id, /^sd-/);
  assert.equal(body.seeker_demand.meal_units, 2);
  assert.equal(body.seeker_demand.reported_by_user_id, "alice");

  const board = await fetch(`http://127.0.0.1:${port}/v1/demand/board`, {
    headers: { authorization: `Bearer ${token}` }
  });
  const boardBody = await board.json();
  assert.equal(boardBody.seeker_demands.length, 1);
  assert.equal(boardBody.demand_windows.length, 1);
});

test("POST /v1/seeker-demands allows coordinator reporter", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-demand-coord-"));
  t.after(() => fs.rm(tempDir, { recursive: true, force: true }));

  const store = new PreferencesStore(path.join(tempDir, "preferences.json"));
  const repo = new LocalPreferencesRepository(store);
  await repo.init();
  const orderIntentStore = new OrderIntentStore({ dataDir: tempDir });
  await orderIntentStore.init();
  const seekerDemandStore = new InMemorySeekerDemandStore();
  await seekerDemandStore.init();

  const server = createIntegrationServer({
    preferencesRepository: repo,
    orderIntentStore,
    seekerDemandStore
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  t.after(() => server.close());

  const token = mintAuthToken("coord1", { role: "coordinator" });
  const response = await fetch(`http://127.0.0.1:${port}/v1/seeker-demands`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      need_description: "One hot meal"
    })
  });

  assert.equal(response.status, 201);
});
