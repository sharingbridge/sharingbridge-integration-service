import test from "node:test";
import assert from "node:assert/strict";
import { getDonorNeighbourhoodWindowMs } from "../src/donorNeighbourhoodWindow.js";
import {
  filterRecordsSince,
  formatSinceQuery,
  getDonorListSinceMs,
  parseSinceQuery,
  resolveListSinceMs
} from "../src/sinceFilter.js";

test("parseSinceQuery accepts hour minute day units", () => {
  assert.equal(parseSinceQuery("1h"), 3_600_000);
  assert.equal(parseSinceQuery("2h"), 7_200_000);
  assert.equal(parseSinceQuery("30m"), 1_800_000);
  assert.equal(parseSinceQuery(null), null);
  assert.equal(parseSinceQuery("bad"), null);
});

test("formatSinceQuery renders hour windows", () => {
  assert.equal(formatSinceQuery(getDonorListSinceMs()), "2h");
});

test("resolveListSinceMs caps donor to default window", () => {
  const windowMs = getDonorNeighbourhoodWindowMs();
  assert.equal(resolveListSinceMs("donor", null), windowMs);
  assert.equal(resolveListSinceMs("donor", "7d"), windowMs);
  assert.equal(resolveListSinceMs("coordinator", null), null);
  assert.equal(resolveListSinceMs("coordinator", "2h"), 7_200_000);
});

test("filterRecordsSince keeps recent activity only", () => {
  const now = Date.parse("2026-06-02T12:00:00.000Z");
  const records = [
    { created_at: "2026-06-02T11:30:00.000Z" },
    { created_at: "2026-06-01T10:00:00.000Z" }
  ];
  const filtered = filterRecordsSince(records, 3_600_000, now);
  assert.equal(filtered.length, 1);
});
