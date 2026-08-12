import test from "node:test";
import assert from "node:assert/strict";
import {
  getDonorNeighbourhoodRadiusM,
  parseDonorNeighbourhoodRadiusM,
  parseGeoCoord,
  parseNeighbourhoodQuery
} from "../src/donorNeighbourhoodArea.js";

test("parseDonorNeighbourhoodRadiusM defaults and caps at max only", () => {
  assert.equal(parseDonorNeighbourhoodRadiusM(undefined), 5000);
  assert.equal(parseDonorNeighbourhoodRadiusM("999999"), 50000);
  assert.equal(parseDonorNeighbourhoodRadiusM("2500"), 2500);
});

test("parseGeoCoord validates latitude and longitude", () => {
  assert.equal(parseGeoCoord("12.94", "lat"), 12.94);
  assert.equal(parseGeoCoord("200", "lat"), null);
  assert.equal(parseGeoCoord("80.24", "lng"), 80.24);
});

test("parseNeighbourhoodQuery reads near coords and locality_key", () => {
  const params = new URLSearchParams(
    "near_lat=12.94&near_lng=80.24&locality_key=IN:TN:600115"
  );
  const parsed = parseNeighbourhoodQuery(params);
  assert.equal(parsed.nearLat, 12.94);
  assert.equal(parsed.nearLng, 80.24);
  assert.equal(parsed.localityKey, "IN:TN:600115");
});

test("getDonorNeighbourhoodRadiusM reads INITIATOR_NEIGHBOURHOOD_RADIUS_M", () => {
  const previous = process.env.INITIATOR_NEIGHBOURHOOD_RADIUS_M;
  process.env.INITIATOR_NEIGHBOURHOOD_RADIUS_M = "3000";
  assert.equal(getDonorNeighbourhoodRadiusM(), 3000);
  if (previous == null) {
    delete process.env.INITIATOR_NEIGHBOURHOOD_RADIUS_M;
  } else {
    process.env.INITIATOR_NEIGHBOURHOOD_RADIUS_M = previous;
  }
});
