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

  const { status, body } = await postJson(
    `http://127.0.0.1:${port}`,
    "/v1/donor-seeker/order-intents",
    {
      user_id: "alice",
      pack_id: "pack-test-1",
      status: "instructions_copied",
      has_reference_photo: true,
      verbal_handover_notes: "blue gate",
      presets_snapshot: [
        {
          restaurant_name: "A2B",
          app_name: "Zomato",
          order_url: "https://www.zomato.com/x"
        }
      ]
    }
  );

  assert.equal(status, 201);
  assert.match(body.order_intent_id, /^oi-/);
  assert.equal(body.status, "instructions_copied");
  assert.equal(body.pack_id, "pack-test-1");

  const saved = orderIntentStore.listForUser("alice");
  assert.equal(saved.length, 1);

  const firstId = body.order_intent_id;

  const { status: status2, body: body2 } = await postJson(
    `http://127.0.0.1:${port}`,
    "/v1/donor-seeker/order-intents",
    {
      user_id: "alice",
      pack_id: "pack-test-1",
      status: "instructions_copied",
      has_reference_photo: false,
      verbal_handover_notes: "updated notes"
    }
  );

  assert.equal(status2, 200);
  assert.equal(body2.order_intent_id, firstId);
  assert.equal(body2.created, false);
  const savedAfter = orderIntentStore.listForUser("alice");
  assert.equal(savedAfter.length, 1);
  assert.equal(body2.updated_at, savedAfter[0].updated_at);
  assert.equal(savedAfter[0].verbal_handover_notes, "updated notes");
  assert.equal(savedAfter[0].has_reference_photo, false);

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
