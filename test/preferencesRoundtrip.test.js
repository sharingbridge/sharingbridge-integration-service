import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createIntegrationServer } from "../src/server.js";
import { PreferencesStore } from "../src/preferencesStore.js";
import { LocalPreferencesRepository } from "../src/preferencesRepository.js";
import { mintAuthToken } from "../src/tokenService.js";

async function startTestServer() {
  const tempDir = mkdtempSync(join(tmpdir(), "sb-prefs-"));
  const dbPath = join(tempDir, "preferences.json");
  const store = new PreferencesStore(dbPath);
  const repository = new LocalPreferencesRepository(store);
  await repository.init();
  const server = createIntegrationServer({ preferencesRepository: repository });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  return {
    baseUrl,
    cleanup: () =>
      new Promise((resolve) => {
        server.close(() => {
          rmSync(tempDir, { recursive: true, force: true });
          resolve();
        });
      })
  };
}

const sampleA = {
  restaurant_name: "A2B",
  order_url: "https://example.com/a2b",
  menu_items: ["Mini Meals"],
  app_name: "Zomato"
};

const sampleB = {
  restaurant_name: "Saravana Bhavan",
  order_url: "https://example.com/sb",
  menu_items: ["Idli Sambar"],
  app_name: "Swiggy"
};

test("save then fetch returns the persisted preset for the user", async () => {
  const { baseUrl, cleanup } = await startTestServer();
  try {
    const userId = "user-roundtrip-1";
    const token = mintAuthToken(userId);
    const saveRes = await fetch(`${baseUrl}/v1/donor-setup/preferences`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ user_id: userId, presets: [sampleA] })
    });
    assert.equal(saveRes.status, 200);
    const saveBody = await saveRes.json();
    assert.equal(saveBody.saved_count, 1);
    assert.equal(saveBody.total_count, 1);
    assert.equal(saveBody.preset_ids.length, 1);

    const getRes = await fetch(
      `${baseUrl}/v1/donor-setup/preferences?user_id=${userId}`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json();
    assert.equal(getBody.user_id, userId);
    assert.equal(getBody.presets.length, 1);
    assert.equal(getBody.presets[0].restaurant_name, sampleA.restaurant_name);
    assert.equal(getBody.presets[0].order_url, sampleA.order_url);
    assert.ok(getBody.presets[0].id, "saved preset must have id");
    assert.ok(getBody.presets[0].saved_at, "saved preset must have saved_at");
  } finally {
    await cleanup();
  }
});

test("save dedupes by (restaurant_name, order_url) on repeat save", async () => {
  const { baseUrl, cleanup } = await startTestServer();
  try {
    const userId = "user-dedupe";
    const token = mintAuthToken(userId);

    const firstSave = await fetch(`${baseUrl}/v1/donor-setup/preferences`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ user_id: userId, presets: [sampleA, sampleB] })
    });
    assert.equal(firstSave.status, 200);
    const firstBody = await firstSave.json();
    assert.equal(firstBody.total_count, 2);

    // Saving sampleA again must not grow the user's preset list.
    const secondSave = await fetch(`${baseUrl}/v1/donor-setup/preferences`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        user_id: userId,
        presets: [{ ...sampleA, menu_items: ["Mini Meals", "Curd Rice"] }]
      })
    });
    assert.equal(secondSave.status, 200);
    const secondBody = await secondSave.json();
    assert.equal(secondBody.total_count, 2, "duplicate save must not grow set");

    const getRes = await fetch(
      `${baseUrl}/v1/donor-setup/preferences?user_id=${userId}`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    const getBody = await getRes.json();
    assert.equal(getBody.presets.length, 2);

    const a2b = getBody.presets.find(
      (p) => p.order_url === sampleA.order_url
    );
    assert.ok(a2b, "A2B preset must still be present");
    assert.deepEqual(
      a2b.menu_items,
      ["Mini Meals", "Curd Rice"],
      "dedupe must replace with the latest payload"
    );
  } finally {
    await cleanup();
  }
});

test("preferences are isolated per user_id", async () => {
  const { baseUrl, cleanup } = await startTestServer();
  try {
    const aliceToken = mintAuthToken("alice");
    const bobToken = mintAuthToken("bob");
    await fetch(`${baseUrl}/v1/donor-setup/preferences`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({ user_id: "alice", presets: [sampleA] })
    });
    await fetch(`${baseUrl}/v1/donor-setup/preferences`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${bobToken}`
      },
      body: JSON.stringify({ user_id: "bob", presets: [sampleB] })
    });

    const aliceRes = await fetch(
      `${baseUrl}/v1/donor-setup/preferences?user_id=alice`,
      { headers: { authorization: `Bearer ${aliceToken}` } }
    );
    const aliceBody = await aliceRes.json();
    const bobRes = await fetch(
      `${baseUrl}/v1/donor-setup/preferences?user_id=bob`,
      { headers: { authorization: `Bearer ${bobToken}` } }
    );
    const bobBody = await bobRes.json();

    assert.equal(aliceBody.presets.length, 1);
    assert.equal(aliceBody.presets[0].restaurant_name, "A2B");
    assert.equal(bobBody.presets.length, 1);
    assert.equal(bobBody.presets[0].restaurant_name, "Saravana Bhavan");
  } finally {
    await cleanup();
  }
});

test("save rejects malformed presets without persisting", async () => {
  const { baseUrl, cleanup } = await startTestServer();
  try {
    const userId = "user-bad-input";
    const token = mintAuthToken(userId);
    const res = await fetch(`${baseUrl}/v1/donor-setup/preferences`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        user_id: userId,
        presets: [{ app_name: "Zomato" }]
      })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.code, "invalid_request");

    const getRes = await fetch(
      `${baseUrl}/v1/donor-setup/preferences?user_id=${userId}`,
      { headers: { authorization: `Bearer ${token}` } }
    );
    const getBody = await getRes.json();
    assert.equal(getBody.presets.length, 0);
  } finally {
    await cleanup();
  }
});
