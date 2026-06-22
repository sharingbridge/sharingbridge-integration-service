import assert from "node:assert/strict";
import test from "node:test";
import { buildOrderIntentListSql } from "../src/orderIntentGeoSql.js";

test("buildOrderIntentListSql donor own_only applies user_id and since", () => {
  const { text, values } = buildOrderIntentListSql({
    sinceMs: 7_200_000,
    neighbourhoodScope: null,
    viewerUserId: "alice",
    role: "donor"
  });
  assert.match(text, /updated_at >= \$1/);
  assert.match(text, /user_id = \$2/);
  assert.doesNotMatch(text, /sb_gis\.ST_DWithin/);
  assert.equal(values[1], "alice");
});

test("buildOrderIntentListSql donor near uses ST_DWithin and viewer OR", () => {
  const { text, values } = buildOrderIntentListSql({
    sinceMs: 7_200_000,
    neighbourhoodScope: {
      type: "near",
      nearLat: 12.97,
      nearLng: 80.22,
      radiusM: 5000
    },
    viewerUserId: "alice",
    role: "donor"
  });
  assert.match(text, /sb_gis\.ST_DWithin/);
  assert.match(text, /user_id = \$/);
  assert.doesNotMatch(text, /OR location IS NULL/);
  assert.equal(values.includes(12.97), true);
  assert.equal(values.includes(80.22), true);
  assert.equal(values.includes(5000), true);
});

test("buildOrderIntentListSql coordinator without scope has no user_id lock", () => {
  const { text, values } = buildOrderIntentListSql({
    neighbourhoodScope: null,
    viewerUserId: "coord-1",
    role: "coordinator",
    maxRows: 25
  });
  assert.doesNotMatch(text, /user_id = \$1/);
  assert.match(text, /LIMIT \$/);
  assert.equal(values.length, 1);
  assert.equal(values[0], 25);
});

test("buildOrderIntentListSql coordinator near uses pure geo radius", () => {
  const { text } = buildOrderIntentListSql({
    neighbourhoodScope: {
      type: "near",
      nearLat: 13,
      nearLng: 80,
      radiusM: 3000
    },
    viewerUserId: "coord-1",
    role: "coordinator"
  });
  assert.match(text, /sb_gis\.ST_DWithin/);
  assert.doesNotMatch(text, /OR location IS NULL/);
  assert.doesNotMatch(text, /user_id =/);
});

test("buildOrderIntentListSql near scope returns distance_m and sorts ascending", () => {
  const { text, values } = buildOrderIntentListSql({
    neighbourhoodScope: {
      type: "near",
      nearLat: 12.97,
      nearLng: 80.22,
      radiusM: 5000
    },
    viewerUserId: "alice",
    role: "donor",
    maxRows: 50
  });
  assert.match(text, /sb_gis\.ST_Distance/);
  assert.match(text, /distance_m/);
  assert.match(text, /ORDER BY distance_m ASC NULLS LAST/);
  assert.match(text, /LIMIT \$/);
  assert.equal(values.at(-1), 50);
});

test("buildOrderIntentListSql includes delivered_at column", () => {
  const { text } = buildOrderIntentListSql({
    neighbourhoodScope: null,
    viewerUserId: "alice",
    role: "donor"
  });
  assert.match(text, /delivered_at/);
});

test("buildOrderIntentListSql coordinator locality matches column or payload key", () => {
  const { text, values } = buildOrderIntentListSql({
    neighbourhoodScope: {
      type: "locality",
      localityKey: "IN:TN:600097"
    },
    viewerUserId: "coord-1",
    role: "coordinator"
  });
  assert.match(text, /COALESCE/);
  assert.match(text, /payload->>'locality_key'/);
  assert.equal(values.includes("IN:TN:600097"), true);
  assert.equal(values.includes("IN:TN:600097:%"), true);
});
