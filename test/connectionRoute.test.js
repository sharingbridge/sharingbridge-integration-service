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

function fixtureOffer(id) {
  const offer = FIXTURE_STANDARD_OFFERS.find((row) => row.id === id);
  if (!offer) {
    throw new Error(`Missing fixture offer ${id}`);
  }
  return offer;
}

async function seedSeekerDemand(store, userId) {
  let record = buildSeekerDemandRecord(
    {
      standard_offer_id: TEST_OFFER_ID,
      meal_units: 2,
      email_share_consent: true
    },
    { reportedByUserId: userId, standardOffer: fixtureOffer(TEST_OFFER_ID) }
  );
  record = applyLocationToRecord(record, {
    lat: 12.9427,
    lng: 80.2379,
    label: "",
    localityKey: FIXTURE_LOCALITY_POSTAL
  });
  return store.insertForReporter(userId, record);
}

test("GET /v1/connections/:orderCode returns kitchen email after commit", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-conn-"));
  t.after(() => fs.rm(tempDir, { recursive: true, force: true }));

  const store = new PreferencesStore(path.join(tempDir, "preferences.json"));
  const repo = new LocalPreferencesRepository(store);
  await repo.init();
  const orderIntentStore = new OrderIntentStore({ dataDir: tempDir });
  await orderIntentStore.init();
  const marketplaceStore = new InMemoryMarketplaceStore();
  const seekerDemandStore = new InMemorySeekerDemandStore();
  const demand = await seedSeekerDemand(seekerDemandStore, "alice");
  const orderCode = demand.order_code;

  const server = createIntegrationServer({
    preferencesRepository: repo,
    orderIntentStore,
    marketplaceStore,
    seekerDemandStore,
    lookupEmailsByUserId: async (userIds) => {
      const map = {};
      for (const id of userIds) {
        map[id] = `${id}@example.com`;
      }
      return map;
    }
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  t.after(() => server.close());

  const coordToken = mintAuthToken("coord-1", { role: "coordinator" });
  const bid = await fetch(`http://127.0.0.1:${port}/v1/vendor-bids`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${coordToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      locality_key: FIXTURE_LOCALITY_POSTAL,
      standard_offer_id: TEST_OFFER_ID,
      vendor_name: "Eco Kitchen A",
      portions: 10,
      email_share_consent: true
    })
  });
  assert.equal(bid.status, 201);

  const aliceToken = mintAuthToken("alice", { role: "donor" });
  const response = await fetch(
    `http://127.0.0.1:${port}/v1/connections/${encodeURIComponent(orderCode)}`,
    { headers: { authorization: `Bearer ${aliceToken}` } }
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.connection.order_code, orderCode);
  assert.equal(body.connection.status, "ready");
  assert.equal(body.connection.viewer_role, "initiator");
  assert.equal(body.connection.kitchen.login_email, "coord-1@example.com");
});

test("GET /v1/connections/:orderCode rejects unrelated users", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-conn-forbid-"));
  t.after(() => fs.rm(tempDir, { recursive: true, force: true }));

  const store = new PreferencesStore(path.join(tempDir, "preferences.json"));
  const repo = new LocalPreferencesRepository(store);
  await repo.init();
  const orderIntentStore = new OrderIntentStore({ dataDir: tempDir });
  await orderIntentStore.init();
  const seekerDemandStore = new InMemorySeekerDemandStore();
  const demand = await seedSeekerDemand(seekerDemandStore, "alice");

  const server = createIntegrationServer({
    preferencesRepository: repo,
    orderIntentStore,
    marketplaceStore: new InMemoryMarketplaceStore(),
    seekerDemandStore
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  t.after(() => server.close());

  const strangerToken = mintAuthToken("bob", { role: "donor" });
  const response = await fetch(
    `http://127.0.0.1:${port}/v1/connections/${encodeURIComponent(demand.order_code)}`,
    { headers: { authorization: `Bearer ${strangerToken}` } }
  );
  assert.equal(response.status, 403);
});
