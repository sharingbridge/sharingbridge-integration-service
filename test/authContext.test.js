import test from "node:test";
import assert from "node:assert/strict";
import {
  extractUserIdFromHeaders,
  resolveAuthenticatedUserId
} from "../src/authContext.js";

test("extracts user_id from Bearer demo.<user_id> token", () => {
  const userId = extractUserIdFromHeaders({
    authorization: "Bearer demo.alice"
  });
  assert.equal(userId, "alice");
});

test("extracts user_id from X-User-Id header when no bearer", () => {
  const userId = extractUserIdFromHeaders({ "x-user-id": "bob" });
  assert.equal(userId, "bob");
});

test("bearer demo. token wins over X-User-Id header", () => {
  const userId = extractUserIdFromHeaders({
    authorization: "Bearer demo.alice",
    "x-user-id": "bob"
  });
  assert.equal(userId, "alice");
});

test("ignores non-demo bearer tokens (handled by future real auth)", () => {
  const userId = extractUserIdFromHeaders({
    authorization: "Bearer some.other.jwt"
  });
  assert.equal(userId, null);
});

test("returns null when no auth context is present", () => {
  assert.equal(extractUserIdFromHeaders({}), null);
  assert.equal(extractUserIdFromHeaders(null), null);
});

test("resolveAuthenticatedUserId prefers header over supplied", () => {
  const result = resolveAuthenticatedUserId({
    headerUserId: "alice",
    supplied: "alice"
  });
  assert.equal(result.userId, "alice");
  assert.equal(result.error, null);
});

test("resolveAuthenticatedUserId rejects header/supplied mismatch with 403", () => {
  const result = resolveAuthenticatedUserId({
    headerUserId: "alice",
    supplied: "bob"
  });
  assert.equal(result.userId, null);
  assert.equal(result.error.status, 403);
  assert.equal(result.error.body.code, "user_id_mismatch");
});

test("resolveAuthenticatedUserId returns 401 when nothing is provided", () => {
  const result = resolveAuthenticatedUserId({
    headerUserId: null,
    supplied: null
  });
  assert.equal(result.userId, null);
  assert.equal(result.error.status, 401);
  assert.equal(result.error.body.code, "missing_auth_context");
});

test("resolveAuthenticatedUserId falls back to supplied when header missing", () => {
  const result = resolveAuthenticatedUserId({
    headerUserId: null,
    supplied: "carol"
  });
  assert.equal(result.userId, "carol");
  assert.equal(result.error, null);
});
