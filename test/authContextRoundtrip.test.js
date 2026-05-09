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
  const tempDir = mkdtempSync(join(tmpdir(), "sb-auth-"));
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

const samplePreset = {
  restaurant_name: "A2B",
  order_url: "https://example.com/a2b",
  menu_items: ["Mini Meals"],
  app_name: "Zomato"
};

test("save uses signed Bearer token without body user_id", async () => {
  const { baseUrl, cleanup } = await startTestServer();
  try {
    const token = mintAuthToken("alice");
    const res = await fetch(`${baseUrl}/v1/donor-setup/preferences`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ presets: [samplePreset] })
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.user_id, "alice");

    const getRes = await fetch(`${baseUrl}/v1/donor-setup/preferences`, {
      headers: { authorization: `Bearer ${token}` }
    });
    const getBody = await getRes.json();
    assert.equal(getBody.user_id, "alice");
    assert.equal(getBody.presets.length, 1);
  } finally {
    await cleanup();
  }
});

test("save rejects body user_id that disagrees with auth context (403)", async () => {
  const { baseUrl, cleanup } = await startTestServer();
  try {
    const aliceToken = mintAuthToken("alice");
    const res = await fetch(`${baseUrl}/v1/donor-setup/preferences`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${aliceToken}`
      },
      body: JSON.stringify({ user_id: "bob", presets: [samplePreset] })
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, "user_id_mismatch");

    // Nothing should have been persisted under either id.
    const bobToken = mintAuthToken("bob");
    const getAlice = await fetch(`${baseUrl}/v1/donor-setup/preferences`, {
      headers: { authorization: `Bearer ${aliceToken}` }
    });
    const getBob = await fetch(`${baseUrl}/v1/donor-setup/preferences`, {
      headers: { authorization: `Bearer ${bobToken}` }
    });
    assert.equal((await getAlice.json()).presets.length, 0);
    assert.equal((await getBob.json()).presets.length, 0);
  } finally {
    await cleanup();
  }
});

test("preferences endpoints return 401 when no auth context is provided", async () => {
  const { baseUrl, cleanup } = await startTestServer();
  try {
    const getRes = await fetch(`${baseUrl}/v1/donor-setup/preferences`);
    assert.equal(getRes.status, 401);
    const getBody = await getRes.json();
    assert.equal(getBody.code, "missing_auth_context");

    const postRes = await fetch(`${baseUrl}/v1/donor-setup/preferences`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ presets: [samplePreset] })
    });
    assert.equal(postRes.status, 401);
    const postBody = await postRes.json();
    assert.equal(postBody.code, "missing_auth_context");
  } finally {
    await cleanup();
  }
});

test("missing token is rejected even with legacy user_id body/query", async () => {
  const { baseUrl, cleanup } = await startTestServer();
  try {
    const saveRes = await fetch(`${baseUrl}/v1/donor-setup/preferences`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user_id: "legacy", presets: [samplePreset] })
    });
    assert.equal(saveRes.status, 401);
    const saveBody = await saveRes.json();
    assert.equal(saveBody.code, "missing_auth_context");

    const getRes = await fetch(
      `${baseUrl}/v1/donor-setup/preferences?user_id=legacy`
    );
    assert.equal(getRes.status, 401);
    const body = await getRes.json();
    assert.equal(body.code, "missing_auth_context");
  } finally {
    await cleanup();
  }
});
