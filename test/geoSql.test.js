import assert from "node:assert/strict";
import test from "node:test";
import { gisFn, resolveGisSchema } from "../src/geoSql.js";

test("resolveGisSchema defaults to sb_gis", () => {
  assert.equal(resolveGisSchema({}), "sb_gis");
});

test("resolveGisSchema reads GIS_SCHEMA", () => {
  assert.equal(resolveGisSchema({ GIS_SCHEMA: "gis_ext" }), "gis_ext");
});

test("resolveGisSchema rejects invalid identifiers", () => {
  assert.throws(() => resolveGisSchema({ GIS_SCHEMA: "bad-name" }));
  assert.throws(() => resolveGisSchema({ GIS_SCHEMA: "9gis" }));
});

test("gisFn qualifies with configured schema", () => {
  assert.equal(gisFn("ST_DWithin"), `${resolveGisSchema()}.ST_DWithin`);
});
