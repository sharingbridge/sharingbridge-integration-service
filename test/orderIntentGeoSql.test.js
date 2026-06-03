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
  assert.doesNotMatch(text, /ST_DWithin/);
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
  assert.match(text, /ST_DWithin/);
  assert.match(text, /user_id = \$/);
  assert.equal(values.includes(12.97), true);
  assert.equal(values.includes(80.22), true);
  assert.equal(values.includes(5000), true);
});

test("buildOrderIntentListSql coordinator without scope has no user_id lock", () => {
  const { text, values } = buildOrderIntentListSql({
    neighbourhoodScope: null,
    viewerUserId: "coord-1",
    role: "coordinator"
  });
  assert.doesNotMatch(text, /user_id = \$1/);
  assert.equal(values.length, 0);
});

test("buildOrderIntentListSql coordinator near uses ST_DWithin", () => {
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
  assert.match(text, /ST_DWithin/);
});
