import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { AiOrchestrationClient } from "../src/aiOrchestrationClient.js";
import { createIntegrationServer } from "../src/server.js";
import { LocalPreferencesRepository } from "../src/preferencesRepository.js";
import { PreferencesStore } from "../src/preferencesStore.js";

function startOrchestrationStub() {
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      const parsed = JSON.parse(body || "{}");
      if (req.url === "/internal/v1/llm/suggest-vendors") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            suggestions: [
              {
                restaurant_name: "Stub Cafe",
                menu_items: ["Tea"],
                order_url: "https://example.com",
                app_name: "Zomato",
                confidence: 0.9,
                notes: "from stub orchestration"
              }
            ],
            generated_at: "2026-01-01T00:00:00.000Z",
            source: "orchestration"
          })
        );
        return;
      }
      if (req.url === "/internal/v1/llm/instruction-pack") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            pack_id: "pack-1",
            delivery_instructions: `Orchestrated for ${parsed.verbal_handover_notes || "none"}`,
            generated_at: "2026-01-01T00:00:00.000Z",
            source: "orchestration"
          })
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });
  });
  return server;
}

async function postJson(baseUrl, path, payload, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {} };
}

test("suggest-vendors uses orchestration when feature flag enabled", async (t) => {
  const stub = startOrchestrationStub();
  await new Promise((resolve) => stub.listen(0, resolve));
  const { port } = stub.address();
  t.after(() => stub.close());

  const prevBase = process.env.AI_ORCHESTRATION_BASE_URL;
  const prevFlag = process.env.AI_SUGGEST_VENDORS_ENABLED;
  process.env.AI_ORCHESTRATION_BASE_URL = `http://127.0.0.1:${port}`;
  process.env.AI_SUGGEST_VENDORS_ENABLED = "true";
  t.after(() => {
    process.env.AI_ORCHESTRATION_BASE_URL = prevBase;
    process.env.AI_SUGGEST_VENDORS_ENABLED = prevFlag;
  });

  const store = new PreferencesStore();
  const repo = new LocalPreferencesRepository(store);
  await repo.init();
  const integration = createIntegrationServer({
    preferencesRepository: repo,
    aiOrchestrationClient: new AiOrchestrationClient({
      baseUrl: process.env.AI_ORCHESTRATION_BASE_URL,
      fetchImpl: globalThis.fetch
    })
  });
  await new Promise((resolve) => integration.listen(0, resolve));
  const integrationPort = integration.address().port;
  t.after(() => integration.close());

  const { status, body } = await postJson(
    `http://127.0.0.1:${integrationPort}`,
    "/v1/donor-setup/suggest-vendors",
    {
      query_text: "zomato",
      lat: 12.9,
      lng: 80.2,
      location_precision: "gps"
    }
  );

  assert.equal(status, 200);
  assert.equal(body.source, "orchestration");
  assert.equal(body.suggestions[0].restaurant_name, "Stub Cafe");
});

test("instruction-pack returns orchestrated delivery text", async (t) => {
  const stub = startOrchestrationStub();
  await new Promise((resolve) => stub.listen(0, resolve));
  const { port } = stub.address();
  t.after(() => stub.close());

  const prevBase = process.env.AI_ORCHESTRATION_BASE_URL;
  const prevFlag = process.env.AI_INSTRUCTION_PACK_ENABLED;
  process.env.AI_ORCHESTRATION_BASE_URL = `http://127.0.0.1:${port}`;
  process.env.AI_INSTRUCTION_PACK_ENABLED = "true";
  t.after(() => {
    process.env.AI_ORCHESTRATION_BASE_URL = prevBase;
    process.env.AI_INSTRUCTION_PACK_ENABLED = prevFlag;
  });

  const store = new PreferencesStore();
  const repo = new LocalPreferencesRepository(store);
  await repo.init();
  const integration = createIntegrationServer({
    preferencesRepository: repo,
    aiOrchestrationClient: new AiOrchestrationClient({
      baseUrl: process.env.AI_ORCHESTRATION_BASE_URL,
      fetchImpl: globalThis.fetch
    })
  });
  await new Promise((resolve) => integration.listen(0, resolve));
  const integrationPort = integration.address().port;
  t.after(() => integration.close());

  const { status, body } = await postJson(
    `http://127.0.0.1:${integrationPort}`,
    "/v1/donor-seeker/instruction-pack",
    {
      user_id: "demo-user",
      verbal_handover_notes: "red gate",
      has_reference_photo: false,
      presets: [
        {
          restaurant_name: "Cafe",
          menu_items: ["Soup"],
          app_name: "Swiggy"
        }
      ]
    }
  );

  assert.equal(status, 200);
  assert.match(body.delivery_instructions, /red gate/);
  assert.equal(body.source, "orchestration");
});
