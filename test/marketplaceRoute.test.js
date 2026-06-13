import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createIntegrationServer } from "../src/server.js";
import { LocalPreferencesRepository } from "../src/preferencesRepository.js";
import { PreferencesStore } from "../src/preferencesStore.js";
import { OrderIntentStore } from "../src/orderIntentStore.js";
import { InMemoryMarketplaceStore } from "./support/inMemoryMarketplaceStore.js";
import { InMemorySeekerDemandStore } from "./support/inMemorySeekerDemandStore.js";
import { applyLocationToRecord } from "../src/orderIntentLocation.js";
import { buildSeekerDemandRecord } from "../src/seekerDemands.js";
import {
  FIXTURE_LOCALITY_POSTAL,
  FIXTURE_STANDARD_OFFERS
} from "./fixtures/standardOffersCatalog.js";
import { mintAuthToken } from "../src/tokenService.js";

const TEST_OFFER_ID = "so-lunch-full";
const FIXTURE_LAT = 12.9427;
const FIXTURE_LNG = 80.2379;

function fixtureOffer(id) {
  const offer = FIXTURE_STANDARD_OFFERS.find((row) => row.id === id);
  if (!offer) {
    throw new Error(`Missing fixture offer ${id}`);
  }
  return offer;
}

async function seedSeekerDemand(
  store,
  userId,
  localityKey = FIXTURE_LOCALITY_POSTAL,
  offerId = TEST_OFFER_ID
) {
  let record = buildSeekerDemandRecord(
    { standard_offer_id: offerId, meal_units: 2 },
    { reportedByUserId: userId, standardOffer: fixtureOffer(offerId) }
  );
  record = applyLocationToRecord(record, {
    lat: FIXTURE_LAT,
    lng: FIXTURE_LNG,
    label: "",
    localityKey
  });
  return store.insertForReporter(userId, record);
}

test("POST /v1/pledges and /v1/vendor-bids appear on demand board", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-marketplace-"));
  t.after(() => fs.rm(tempDir, { recursive: true, force: true }));

  const store = new PreferencesStore(path.join(tempDir, "preferences.json"));
  const repo = new LocalPreferencesRepository(store);
  await repo.init();
  const orderIntentStore = new OrderIntentStore({ dataDir: tempDir });
  await orderIntentStore.init();
  const marketplaceStore = new InMemoryMarketplaceStore();
  const seekerDemandStore = new InMemorySeekerDemandStore();
  await seedSeekerDemand(seekerDemandStore, "alice");

  const server = createIntegrationServer({
    preferencesRepository: repo,
    orderIntentStore,
    marketplaceStore,
    seekerDemandStore
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  t.after(() => server.close());

  const donorToken = mintAuthToken("alice", { role: "donor" });
  const coordToken = mintAuthToken("coord-1", { role: "coordinator" });

  const pledge = await fetch(`http://127.0.0.1:${port}/v1/pledges`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${donorToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      locality_key: FIXTURE_LOCALITY_POSTAL,
      standard_offer_id: TEST_OFFER_ID,
      meal_units: 3
    })
  });
  assert.equal(pledge.status, 201);

  const bid = await fetch(`http://127.0.0.1:${port}/v1/vendor-bids`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${coordToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      locality_key: FIXTURE_LOCALITY_POSTAL,
      standard_offer_id: TEST_OFFER_ID,
      vendor_name: "A2B Kitchen",
      portions: 20
    })
  });
  assert.equal(bid.status, 201);

  const board = await fetch(`http://127.0.0.1:${port}/v1/demand/board`, {
    headers: { authorization: `Bearer ${coordToken}` }
  });
  const body = JSON.parse(await board.text());
  assert.equal(body.pledges.length, 1);
  assert.equal(body.vendor_bids.length, 1);
  assert.equal(body.demand_windows[0].standard_offer_id, TEST_OFFER_ID);
  assert.equal(body.demand_windows[0].allocation_hint, "balanced");
});

test("POST /v1/pledges allows coordinator reporter", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-marketplace-"));
  t.after(() => fs.rm(tempDir, { recursive: true, force: true }));

  const store = new PreferencesStore(path.join(tempDir, "preferences.json"));
  const repo = new LocalPreferencesRepository(store);
  await repo.init();
  const orderIntentStore = new OrderIntentStore({ dataDir: tempDir });
  await orderIntentStore.init();
  const marketplaceStore = new InMemoryMarketplaceStore();
  const seekerDemandStore = new InMemorySeekerDemandStore();
  await seedSeekerDemand(seekerDemandStore, "alice");

  const server = createIntegrationServer({
    preferencesRepository: repo,
    orderIntentStore,
    marketplaceStore,
    seekerDemandStore
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  t.after(() => server.close());

  const coordToken = mintAuthToken("coord-1", { role: "coordinator" });
  const pledge = await fetch(`http://127.0.0.1:${port}/v1/pledges`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${coordToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      locality_key: FIXTURE_LOCALITY_POSTAL,
      standard_offer_id: TEST_OFFER_ID,
      meal_units: 2
    })
  });
  assert.equal(pledge.status, 201);
});

test("POST /v1/pledges rejects offer line that does not match demand", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-marketplace-"));
  t.after(() => fs.rm(tempDir, { recursive: true, force: true }));

  const store = new PreferencesStore(path.join(tempDir, "preferences.json"));
  const repo = new LocalPreferencesRepository(store);
  await repo.init();
  const orderIntentStore = new OrderIntentStore({ dataDir: tempDir });
  await orderIntentStore.init();
  const marketplaceStore = new InMemoryMarketplaceStore();
  const seekerDemandStore = new InMemorySeekerDemandStore();
  await seedSeekerDemand(seekerDemandStore, "alice");

  const server = createIntegrationServer({
    preferencesRepository: repo,
    orderIntentStore,
    marketplaceStore,
    seekerDemandStore
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  t.after(() => server.close());

  const donorToken = mintAuthToken("alice", { role: "donor" });
  const response = await fetch(`http://127.0.0.1:${port}/v1/pledges`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${donorToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      locality_key: "IN:KA:560001",
      standard_offer_id: TEST_OFFER_ID,
      meal_units: 1
    })
  });
  assert.equal(response.status, 400);
  const body = JSON.parse(await response.text());
  assert.equal(body.code, "invalid_offer_selection");
});
