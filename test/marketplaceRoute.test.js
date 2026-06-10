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
import { mintAuthToken } from "../src/tokenService.js";

test("POST /v1/pledges and /v1/vendor-bids appear on demand board", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-marketplace-"));
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

  const donorToken = mintAuthToken("alice", { role: "donor" });
  const coordToken = mintAuthToken("coord-1", { role: "coordinator" });

  const pledge = await fetch(`http://127.0.0.1:${port}/v1/pledges`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${donorToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      locality_key: "12.94,80.24",
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
      locality_key: "12.94,80.24",
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
});
