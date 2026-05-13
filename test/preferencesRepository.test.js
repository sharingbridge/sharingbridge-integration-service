import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  LocalPreferencesRepository,
  UserServicePreferencesError,
  UserServicePreferencesRepository
} from "../src/preferencesRepository.js";

class _FakeStore {
  constructor() {
    this.byUser = new Map();
  }
  async init() {}
  getByUser(userId) {
    return this.byUser.get(userId) || [];
  }
  async saveForUser(userId, presets) {
    this.byUser.set(userId, presets);
    return presets;
  }
  async clearForUser(userId) {
    this.byUser.set(userId, []);
    return [];
  }
  async removePresetForUser(userId, key) {
    const list = this.byUser.get(userId) || [];
    const norm = (p) =>
      `${String(p.restaurant_name ?? "").trim()}|${String(p.order_url ?? "").trim()}`;
    const target = norm(key);
    const next = list.filter((p) => norm(p) !== target);
    this.byUser.set(userId, next);
    return next;
  }
}

test("LocalPreferencesRepository delegates list and upsert to store", async () => {
  const store = new _FakeStore();
  const repository = new LocalPreferencesRepository(store);
  await repository.init();

  await repository.upsertForUser("alice", [{ id: "p1" }]);
  const presets = await repository.listByUser("alice");
  assert.deepEqual(presets, [{ id: "p1" }]);
});

test("LocalPreferencesRepository clearForUser empties store for user", async () => {
  const store = new _FakeStore();
  const repository = new LocalPreferencesRepository(store);
  await repository.init();
  await repository.upsertForUser("alice", [{ id: "p1" }]);
  const cleared = await repository.clearForUser("alice");
  assert.deepEqual(cleared, []);
  assert.deepEqual(await repository.listByUser("alice"), []);
});

test("LocalPreferencesRepository removePresetForUser removes matching row", async () => {
  const store = new _FakeStore();
  const repository = new LocalPreferencesRepository(store);
  await repository.init();
  await repository.upsertForUser("alice", [
    { restaurant_name: "A", order_url: "http://a" },
    { restaurant_name: "B", order_url: "http://b" }
  ]);
  const next = await repository.removePresetForUser("alice", {
    restaurant_name: "A",
    order_url: "http://a"
  });
  assert.equal(next.length, 1);
  assert.equal(next[0].restaurant_name, "B");
});

test("LocalPreferencesRepository requires a store", () => {
  assert.throws(
    () => new LocalPreferencesRepository(null),
    /requires a PreferencesStore/
  );
});

test("UserServicePreferencesRepository requires baseUrl", () => {
  assert.throws(
    () => new UserServicePreferencesRepository({}),
    /requires baseUrl/
  );
});

async function startStubUserService(handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    cleanup: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
      })
  };
}

test("UserServicePreferencesRepository listByUser calls GET and forwards auth", async () => {
  let seenAuthorization = null;
  let seenXUserId = null;
  let seenPath = null;
  const stub = await startStubUserService((req, res) => {
    seenPath = req.url;
    seenAuthorization = req.headers.authorization;
    seenXUserId = req.headers["x-user-id"];
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ presets: [{ id: "p1", restaurant_name: "A2B" }] }));
  });
  try {
    const repository = new UserServicePreferencesRepository({
      baseUrl: stub.baseUrl
    });
    const presets = await repository.listByUser("alice", {
      authHeaders: {
        authorization: "Bearer demo.alice",
        "x-user-id": "alice"
      }
    });
    assert.equal(seenPath, "/v1/users/alice/donor-presets");
    assert.equal(seenAuthorization, "Bearer demo.alice");
    assert.equal(seenXUserId, "alice");
    assert.equal(presets.length, 1);
    assert.equal(presets[0].id, "p1");
  } finally {
    await stub.cleanup();
  }
});

test("UserServicePreferencesRepository upsertForUser sends PUT payload", async () => {
  let seenMethod = null;
  let seenBody = null;
  const stub = await startStubUserService((req, res) => {
    seenMethod = req.method;
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      seenBody = JSON.parse(raw || "{}");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ presets: seenBody.presets || [] }));
    });
  });
  try {
    const repository = new UserServicePreferencesRepository({
      baseUrl: stub.baseUrl
    });
    const payload = [{ id: "p1", restaurant_name: "A2B" }];
    const saved = await repository.upsertForUser("alice", payload);
    assert.equal(seenMethod, "PUT");
    assert.deepEqual(seenBody, { presets: payload });
    assert.deepEqual(saved, payload);
  } finally {
    await stub.cleanup();
  }
});

test("UserServicePreferencesRepository removePresetForUser POSTs delete-item", async () => {
  let seenMethod = null;
  let seenPath = null;
  let seenBody = null;
  const stub = await startStubUserService((req, res) => {
    seenMethod = req.method;
    seenPath = req.url;
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      seenBody = JSON.parse(raw || "{}");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          presets: [{ restaurant_name: "B", order_url: "http://b" }]
        })
      );
    });
  });
  try {
    const repository = new UserServicePreferencesRepository({
      baseUrl: stub.baseUrl
    });
    const remaining = await repository.removePresetForUser(
      "alice",
      { restaurant_name: "A", order_url: "http://a" },
      { authHeaders: { authorization: "Bearer t" } }
    );
    assert.equal(seenMethod, "POST");
    assert.equal(seenPath, "/v1/users/alice/donor-presets/delete-item");
    assert.deepEqual(seenBody, {
      restaurant_name: "A",
      order_url: "http://a"
    });
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].restaurant_name, "B");
  } finally {
    await stub.cleanup();
  }
});

test("UserServicePreferencesRepository clearForUser sends PUT with empty presets", async () => {
  let seenMethod = null;
  let seenBody = null;
  const stub = await startStubUserService((req, res) => {
    seenMethod = req.method;
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      seenBody = JSON.parse(raw || "{}");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ presets: [] }));
    });
  });
  try {
    const repository = new UserServicePreferencesRepository({
      baseUrl: stub.baseUrl
    });
    const cleared = await repository.clearForUser("alice");
    assert.equal(seenMethod, "PUT");
    assert.deepEqual(seenBody, { presets: [] });
    assert.deepEqual(cleared, []);
  } finally {
    await stub.cleanup();
  }
});

test("UserServicePreferencesRepository maps non-2xx to typed error", async () => {
  const stub = await startStubUserService((_req, res) => {
    res.writeHead(403, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        code: "forbidden",
        message: "URL user_id does not match auth user."
      })
    );
  });
  try {
    const repository = new UserServicePreferencesRepository({
      baseUrl: stub.baseUrl
    });
    await assert.rejects(
      () => repository.listByUser("alice"),
      (error) =>
        error instanceof UserServicePreferencesError &&
        error.status === 403 &&
        error.code === "forbidden"
    );
  } finally {
    await stub.cleanup();
  }
});
