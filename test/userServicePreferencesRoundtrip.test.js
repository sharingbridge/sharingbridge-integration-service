import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

import { createIntegrationServer } from "../src/server.js";
import { UserServicePreferencesRepository } from "../src/preferencesRepository.js";
import { mintAuthToken } from "../src/tokenService.js";
import { createTempOrderIntentStore } from "./support/tempIntegrationStores.js";

async function startStubUserService({ alwaysForbidden = false } = {}) {
  const byUser = new Map();
  let seenAuthHeader = null;
  const server = createServer((req, res) => {
    seenAuthHeader = req.headers.authorization || null;
    if (alwaysForbidden) {
      res.writeHead(403, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          code: "forbidden",
          message: "URL user_id does not match auth user."
        })
      );
      return;
    }

    const deleteMatch = /^\/v1\/users\/([^/]+)\/donor-presets\/delete-item$/.exec(
      req.url || ""
    );
    if (deleteMatch && req.method === "POST") {
      const userId = decodeURIComponent(deleteMatch[1]);
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => {
        const key = JSON.parse(raw || "{}");
        const list = byUser.get(userId) || [];
        const target = `${String(key.restaurant_name ?? "").trim()}|${String(key.order_url ?? "").trim()}`;
        const next = list.filter(
          (p) =>
            `${String(p.restaurant_name ?? "").trim()}|${String(p.order_url ?? "").trim()}` !==
            target
        );
        byUser.set(userId, next);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ presets: next }));
      });
      return;
    }

    const getMatch = /^\/v1\/users\/([^/]+)\/donor-presets$/.exec(req.url || "");
    const userId = getMatch ? decodeURIComponent(getMatch[1]) : null;
    if (!userId) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ code: "not_found", message: "Route not found." }));
      return;
    }
    if (req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ presets: byUser.get(userId) || [] }));
      return;
    }
    if (req.method === "PUT") {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk;
      });
      req.on("end", () => {
        const payload = JSON.parse(raw || "{}");
        byUser.set(userId, payload.presets || []);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ presets: byUser.get(userId) || [] }));
      });
      return;
    }
    res.writeHead(405, { "content-type": "application/json" });
    res.end(JSON.stringify({ code: "method_not_allowed" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    getSeenAuthHeader: () => seenAuthHeader,
    cleanup: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      })
  };
}

async function startIntegrationServer(userServiceBaseUrl) {
  const repository = new UserServicePreferencesRepository({
    baseUrl: userServiceBaseUrl
  });
  await repository.init();
  const { orderIntentStore, cleanup: cleanupOrderIntents } =
    await createTempOrderIntentStore();
  const server = createIntegrationServer({
    preferencesRepository: repository,
    orderIntentStore
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    cleanup: async () => {
      await new Promise((resolve) => server.close(() => resolve()));
      await cleanupOrderIntents();
    }
  };
}

test("integration-service forwards auth and persists via user-service backend", async () => {
  const userService = await startStubUserService();
  const integration = await startIntegrationServer(userService.baseUrl);
  try {
    const token = mintAuthToken("alice");
    const save = await fetch(`${integration.baseUrl}/v1/donor-setup/preferences`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        user_id: "alice",
        presets: [
          {
            restaurant_name: "A2B",
            order_url: "https://example.com/a2b",
            menu_items: ["Mini Meals"],
            app_name: "Zomato"
          }
        ]
      })
    });
    assert.equal(save.status, 200);

    const load = await fetch(
      `${integration.baseUrl}/v1/donor-setup/preferences?user_id=alice`,
      {
        headers: { authorization: `Bearer ${token}` }
      }
    );
    assert.equal(load.status, 200);
    const body = await load.json();
    assert.equal(body.presets.length, 1);
    assert.equal(body.presets[0].restaurant_name, "A2B");
    assert.equal(userService.getSeenAuthHeader(), `Bearer ${token}`);
  } finally {
    await integration.cleanup();
    await userService.cleanup();
  }
});

test("integration-service delete-item forwards to user-service delete-item", async () => {
  const userService = await startStubUserService();
  const integration = await startIntegrationServer(userService.baseUrl);
  try {
    const token = mintAuthToken("bob");
    const save = await fetch(`${integration.baseUrl}/v1/donor-setup/preferences`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        user_id: "bob",
        presets: [
          {
            restaurant_name: "X",
            order_url: "https://x.example",
            menu_items: ["a"],
            app_name: "Z"
          },
          {
            restaurant_name: "Y",
            order_url: "https://y.example",
            menu_items: ["b"],
            app_name: "Z"
          }
        ]
      })
    });
    assert.equal(save.status, 200);

    const del = await fetch(
      `${integration.baseUrl}/v1/donor-setup/preferences/delete-item`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          user_id: "bob",
          restaurant_name: "X",
          order_url: "https://x.example"
        })
      }
    );
    assert.equal(del.status, 200);
    const delBody = await del.json();
    assert.equal(delBody.presets.length, 1);
    assert.equal(delBody.presets[0].restaurant_name, "Y");
  } finally {
    await integration.cleanup();
    await userService.cleanup();
  }
});

test("integration-service surfaces 403 from user-service backend", async () => {
  const userService = await startStubUserService({ alwaysForbidden: true });
  const integration = await startIntegrationServer(userService.baseUrl);
  try {
    const token = mintAuthToken("alice");
    const load = await fetch(
      `${integration.baseUrl}/v1/donor-setup/preferences?user_id=alice`,
      {
        headers: { authorization: `Bearer ${token}` }
      }
    );
    assert.equal(load.status, 403);
    const body = await load.json();
    assert.equal(body.code, "forbidden");
  } finally {
    await integration.cleanup();
    await userService.cleanup();
  }
});
