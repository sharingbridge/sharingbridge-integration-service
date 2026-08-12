import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCorsOrigins,
  resolveCorsAllowOrigin
} from "../src/cors.js";

test("parseCorsOrigins supports explicit origins and wildcard", () => {
  assert.deepEqual(parseCorsOrigins(""), {
    allowAll: false,
    origins: new Set()
  });
  assert.equal(parseCorsOrigins("*").allowAll, true);
  const parsed = parseCorsOrigins("http://localhost:5173, https://app.example.com");
  assert.equal(parsed.allowAll, false);
  assert.equal(parsed.origins.has("http://localhost:5173"), true);
  assert.equal(parsed.origins.has("https://app.example.com"), true);
});

test("resolveCorsAllowOrigin matches configured list", () => {
  const config = parseCorsOrigins("http://localhost:5173");
  assert.equal(
    resolveCorsAllowOrigin("http://localhost:5173", config),
    "http://localhost:5173"
  );
  assert.equal(resolveCorsAllowOrigin("http://evil.test", config), null);
});

test("applyCorsHeaders advertises PATCH for browser order-intent updates", async (t) => {
  const { applyCorsHeaders } = await import("../src/cors.js");
  const { createServer } = await import("node:http");
  const config = parseCorsOrigins("http://localhost:5173");
  const server = createServer((req, res) => {
    applyCorsHeaders(req, res, config);
    res.end();
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  t.after(() => server.close());

  const response = await fetch(`http://127.0.0.1:${port}/`, {
    method: "OPTIONS",
    headers: { origin: "http://localhost:5173" }
  });
  assert.equal(
    response.headers.get("access-control-allow-methods")?.includes("PATCH"),
    true
  );
});
