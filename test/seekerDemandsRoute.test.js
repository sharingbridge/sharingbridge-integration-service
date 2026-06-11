import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createIntegrationServer } from "../src/server.js";
import { LocalPreferencesRepository } from "../src/preferencesRepository.js";
import { PreferencesStore } from "../src/preferencesStore.js";
import { OrderIntentStore } from "../src/orderIntentStore.js";
import { InMemoryMarketplaceStore } from "../src/inMemoryMarketplaceStore.js";
import { InMemorySeekerDemandStore } from "../src/inMemorySeekerDemandStore.js";
import { PILOT_LOCALITY_POSTAL } from "../src/pilotStandardOffers.js";
import { mintAuthToken } from "../src/tokenService.js";

const TEST_OFFER_ID = "so-lunch-full";

const demandPayload = {
  standard_offer_id: TEST_OFFER_ID,
  meal_units: 2,
  location_lat: 12.9427,
  location_lng: 80.2379,
  locality_key: PILOT_LOCALITY_POSTAL
};

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
  const marketplaceStore = new InMemoryMarketplaceStore();

  const server = createIntegrationServer({
    preferencesRepository: repo,
    orderIntentStore,
    seekerDemandStore,
    marketplaceStore
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
    body: JSON.stringify(demandPayload)
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.created, true);
  assert.match(body.seeker_demand.seeker_demand_id, /^sd-/);
  assert.equal(body.seeker_demand.meal_units, 2);
  assert.equal(body.seeker_demand.standard_offer_id, TEST_OFFER_ID);
  assert.equal(body.seeker_demand.reported_by_user_id, "alice");
  assert.equal(body.seeker_demand.locality_key, PILOT_LOCALITY_POSTAL);

  const board = await fetch(`http://127.0.0.1:${port}/v1/demand/board`, {
    headers: { authorization: `Bearer ${token}` }
  });
  const boardBody = await board.json();
  assert.equal(boardBody.seeker_demands.length, 1);
  assert.equal(boardBody.demand_windows.length, 1);
  assert.equal(boardBody.demand_windows[0].standard_offer_id, TEST_OFFER_ID);
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
  const marketplaceStore = new InMemoryMarketplaceStore();

  const server = createIntegrationServer({
    preferencesRepository: repo,
    orderIntentStore,
    seekerDemandStore,
    marketplaceStore
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
    body: JSON.stringify(demandPayload)
  });

  assert.equal(response.status, 201);
});

test("GET /v1/standard-offers resolves hierarchical catalog by locality_key", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-offers-"));
  t.after(() => fs.rm(tempDir, { recursive: true, force: true }));

  const store = new PreferencesStore(path.join(tempDir, "preferences.json"));
  const repo = new LocalPreferencesRepository(store);
  await repo.init();
  const orderIntentStore = new OrderIntentStore({ dataDir: tempDir });
  await orderIntentStore.init();
  const marketplaceStore = new InMemoryMarketplaceStore();

  const server = createIntegrationServer({
    preferencesRepository: repo,
    orderIntentStore,
    marketplaceStore
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  t.after(() => server.close());

  const token = mintAuthToken("alice", { role: "donor" });
  const response = await fetch(
    `http://127.0.0.1:${port}/v1/standard-offers?locality_key=${encodeURIComponent(PILOT_LOCALITY_POSTAL)}`,
    { headers: { authorization: `Bearer ${token}` } }
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.locality_key, PILOT_LOCALITY_POSTAL);
  assert.ok(body.standard_offers.length >= 4);
  assert.ok(
    body.standard_offers.some(
      (offer) => offer.standard_offer_id === "so-lunch-full"
    )
  );
  assert.ok(
    body.standard_offers.some(
      (offer) => offer.standard_offer_id === "so-lunch-full-state"
    )
  );
});
