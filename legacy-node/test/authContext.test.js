import test from "node:test";
import assert from "node:assert/strict";
import {
  extractUserIdFromHeaders,
  resolveAuthenticatedUserId
} from "../src/authContext.js";
import { mintAuthToken } from "../src/tokenService.js";

test("extracts user_id from signed bearer token", () => {
  const userId = extractUserIdFromHeaders({
    authorization: `Bearer ${mintAuthToken("alice")}`
  });
  assert.equal(userId, "alice");
});

test("rejects malformed or unsigned bearer tokens", () => {
  const userId = extractUserIdFromHeaders({
    authorization: "Bearer demo.alice"
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

test("resolveAuthenticatedUserId does not trust supplied id without token", () => {
  const result = resolveAuthenticatedUserId({
    headerUserId: null,
    supplied: "carol"
  });
  assert.equal(result.userId, null);
  assert.equal(result.error.status, 401);
});
