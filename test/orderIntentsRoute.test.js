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

async function postJson(baseUrl, route, payload) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {} };
}

async function getJson(baseUrl, route) {
  const response = await fetch(`${baseUrl}${route}`);
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {} };
}

test("POST order-intents registers intent when instructions copied", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-order-intent-"));
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

  const aliceToken = mintAuthToken("alice", { role: "donor" });

  const { status, body } = await fetch(
    `http://127.0.0.1:${port}/v1/donor-seeker/order-intents`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        pack_id: "pack-test-1",
        status: "instructions_copied",
        has_reference_photo: true,
        reference_photo_artifact_id: "pa-test-1",
        reference_photo_view_url: "https://res.cloudinary.com/demo/view.jpg",
        reference_photo_thumbnail_url: "https://res.cloudinary.com/demo/thumb.jpg",
        verbal_handover_notes: "blue gate",
        presets_snapshot: [
          {
            restaurant_name: "A2B",
            app_name: "Zomato",
            order_url: "https://www.zomato.com/x"
          }
        ]
      })
    }
  ).then(async (r) => ({
    status: r.status,
    body: JSON.parse(await r.text())
  }));

  assert.equal(status, 201);
  assert.match(body.order_intent_id, /^oi-/);
  assert.equal(body.status, "instructions_copied");
  assert.equal(body.pack_id, "pack-test-1");

  const saved = orderIntentStore.listForUser("alice");
  assert.equal(saved.length, 1);
  assert.equal(saved[0].reference_photo_artifact_id, "pa-test-1");
  assert.equal(
    saved[0].reference_photo_view_url,
    "https://res.cloudinary.com/demo/view.jpg"
  );

  const firstId = body.order_intent_id;

  const { status: status2, body: body2 } = await fetch(
    `http://127.0.0.1:${port}/v1/donor-seeker/order-intents`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        pack_id: "pack-test-1",
        status: "instructions_copied",
        has_reference_photo: false,
        verbal_handover_notes: "updated notes"
      })
    }
  ).then(async (r) => ({
    status: r.status,
    body: JSON.parse(await r.text())
  }));

  assert.equal(status2, 200);
  assert.equal(body2.order_intent_id, firstId);
  assert.equal(body2.created, false);
  const savedAfter = orderIntentStore.listForUser("alice");
  assert.equal(savedAfter.length, 1);
  assert.equal(body2.updated_at, savedAfter[0].updated_at);
  assert.equal(savedAfter[0].verbal_handover_notes, "updated notes");
  assert.equal(savedAfter[0].has_reference_photo, false);
  assert.equal(savedAfter[0].reference_photo_artifact_id, "");

  const { status: listStatus, body: listBody } = await getJson(
    `http://127.0.0.1:${port}`,
    "/v1/donor-seeker/order-intents?user_id=alice"
  );
  assert.equal(listStatus, 401);

  const listAuthed = await fetch(
    `http://127.0.0.1:${port}/v1/donor-seeker/order-intents`,
    { headers: { authorization: `Bearer ${mintAuthToken("alice")}` } }
  );
  const listAuthedBody = JSON.parse(await listAuthed.text());
  assert.equal(listAuthed.status, 200);
  assert.equal(listAuthedBody.user_id, "alice");
  assert.equal(listAuthedBody.order_intents.length, 1);
  assert.equal(listAuthedBody.order_intents[0].order_intent_id, firstId);
  assert.equal(
    listAuthedBody.order_intents[0].verbal_handover_notes,
    "updated notes"
  );
});

test("coordinator lists order intents across donors", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-order-coord-"));
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

  const aliceToken = mintAuthToken("alice", { role: "donor" });
  await fetch(`http://127.0.0.1:${port}/v1/donor-seeker/order-intents`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${aliceToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      pack_id: "pack-alice",
      status: "instructions_copied",
      has_reference_photo: false,
      presets_snapshot: []
    })
  });

  const bobToken = mintAuthToken("bob", { role: "donor" });
  await fetch(`http://127.0.0.1:${port}/v1/donor-seeker/order-intents`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${bobToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      pack_id: "pack-bob",
      status: "instructions_copied",
      has_reference_photo: false,
      presets_snapshot: []
    })
  });

  const coordToken = mintAuthToken("coord-1", { role: "coordinator" });
  const listRes = await fetch(
    `http://127.0.0.1:${port}/v1/donor-seeker/order-intents`,
    { headers: { authorization: `Bearer ${coordToken}` } }
  );
  const listBody = JSON.parse(await listRes.text());
  assert.equal(listRes.status, 200);
  assert.equal(listBody.role, "coordinator");
  assert.equal(listBody.dashboard, "coordinator");
  assert.equal(listBody.order_intents.length, 2);

  const donorList = await fetch(
    `http://127.0.0.1:${port}/v1/donor-seeker/order-intents`,
    { headers: { authorization: `Bearer ${aliceToken}` } }
  );
  const donorBody = JSON.parse(await donorList.text());
  assert.equal(donorBody.role, "donor");
  assert.equal(donorBody.dashboard, "limited");
  assert.equal(donorBody.since, "2h");
  assert.equal(donorBody.feed?.window_hours, 2);
  assert.equal(donorBody.feed?.location_mode, "own_only");
  assert.equal(donorBody.order_intents.length, 1);
  assert.equal(donorBody.order_intents[0].pack_id, "pack-alice");
});

test("donor list with near_lat near_lng includes neighbours within radius", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-order-near-"));
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

  const nearLat = 12.97;
  const nearLng = 80.22;

  async function register(userId, packId, lat, lng) {
    const token = mintAuthToken(userId, { role: "donor" });
    await fetch(`http://127.0.0.1:${port}/v1/donor-seeker/order-intents`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        pack_id: packId,
        status: "instructions_copied",
        has_reference_photo: false,
        presets_snapshot: [],
        location_lat: lat,
        location_lng: lng,
        location_label: "Test area"
      })
    });
    return token;
  }

  const aliceToken = await register("alice", "pack-alice", nearLat, nearLng);
  await register("bob", "pack-bob", nearLat + 0.01, nearLng + 0.01);
  await register("carol", "pack-carol", 50, 50);

  const listRes = await fetch(
    `http://127.0.0.1:${port}/v1/donor-seeker/order-intents?near_lat=${nearLat}&near_lng=${nearLng}`,
    { headers: { authorization: `Bearer ${aliceToken}` } }
  );
  const body = JSON.parse(await listRes.text());
  assert.equal(listRes.status, 200);
  const packIds = body.order_intents.map((i) => i.pack_id);
  assert.deepEqual(packIds, ["pack-alice", "pack-bob"]);
  assert.equal(body.neighbourhood?.mode, "near");
  assert.equal(body.feed?.location_mode, "near");
  assert.equal(body.feed?.radius_m, 5000);
  const alice = body.order_intents.find((i) => i.pack_id === "pack-alice");
  const bob = body.order_intents.find((i) => i.pack_id === "pack-bob");
  assert.equal(typeof alice.distance_m, "number");
  assert.equal(typeof bob.distance_m, "number");
  assert.ok(alice.distance_m <= bob.distance_m);
  assert.ok(alice.created_at);
  assert.equal(alice.delivered_at, null);
  assert.equal(alice.location_lat, nearLat);
  assert.equal(alice.location_lng, nearLng);
  assert.equal(bob.location_lat, null);
  assert.equal(bob.location_lng, null);
});

test("donor list applies since=2h and drops older intents", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-order-since-"));
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

  const oldIso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  orderIntentStore.byUser.alice = [
    {
      id: "old-intent",
      user_id: "alice",
      pack_id: "pack-old",
      status: "instructions_copied",
      has_reference_photo: false,
      presets_snapshot: [],
      created_at: oldIso,
      updated_at: oldIso
    }
  ];
  await orderIntentStore.persist();

  const aliceToken = mintAuthToken("alice", { role: "donor" });
  await fetch(`http://127.0.0.1:${port}/v1/donor-seeker/order-intents`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${aliceToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      pack_id: "pack-new",
      status: "instructions_copied",
      has_reference_photo: false,
      presets_snapshot: []
    })
  });

  const donorList = await fetch(
    `http://127.0.0.1:${port}/v1/donor-seeker/order-intents`,
    { headers: { authorization: `Bearer ${aliceToken}` } }
  );
  const donorBody = JSON.parse(await donorList.text());
  assert.equal(donorBody.since, "2h");
  assert.equal(donorBody.order_intents.length, 1);
  assert.equal(donorBody.order_intents[0].pack_id, "pack-new");

  const coordToken = mintAuthToken("coord-1", { role: "coordinator" });
  const coordList = await fetch(
    `http://127.0.0.1:${port}/v1/donor-seeker/order-intents`,
    { headers: { authorization: `Bearer ${coordToken}` } }
  );
  const coordBody = JSON.parse(await coordList.text());
  assert.equal(coordBody.since, undefined);
  assert.equal(coordBody.order_intents.length, 2);
});

test("PATCH order-intents lets donor mark payment done", async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "sb-order-patch-"));
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

  const aliceToken = mintAuthToken("alice", { role: "donor" });
  const created = await fetch(
    `http://127.0.0.1:${port}/v1/donor-seeker/order-intents`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        pack_id: "pack-pay-1",
        status: "instructions_copied",
        presets_snapshot: []
      })
    }
  );
  const createdBody = JSON.parse(await created.text());
  const intentId = createdBody.order_intent_id;

  const patch = await fetch(
    `http://127.0.0.1:${port}/v1/donor-seeker/order-intents/${intentId}`,
    {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${aliceToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ payment_status: "paid_externally" })
    }
  );
  assert.equal(patch.status, 200);
  const patchBody = JSON.parse(await patch.text());
  assert.equal(patchBody.order_intent.payment_status, "paid_externally");
});
