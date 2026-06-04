import assert from "node:assert/strict";
import test from "node:test";
import {
  getDonorNeighbourhoodRadiusM,
  parseDonorNeighbourhoodRadiusM
} from "../src/donorNeighbourhoodArea.js";

test("parseDonorNeighbourhoodRadiusM defaults and caps at max only", () => {
  assert.equal(parseDonorNeighbourhoodRadiusM(undefined), 5000);
  assert.equal(parseDonorNeighbourhoodRadiusM(""), 5000);
  assert.equal(parseDonorNeighbourhoodRadiusM(200), 200);
  assert.equal(parseDonorNeighbourhoodRadiusM(30), 30);
  assert.equal(parseDonorNeighbourhoodRadiusM(0), 5000);
  assert.equal(parseDonorNeighbourhoodRadiusM(-10), 5000);
  assert.equal(parseDonorNeighbourhoodRadiusM(99_999), 50_000);
});

test("getDonorNeighbourhoodRadiusM reads DONOR_NEIGHBOURHOOD_RADIUS_M", () => {
  const previous = process.env.DONOR_NEIGHBOURHOOD_RADIUS_M;
  process.env.DONOR_NEIGHBOURHOOD_RADIUS_M = "3000";
  try {
    assert.equal(getDonorNeighbourhoodRadiusM(), 3000);
  } finally {
    if (previous != null) {
      process.env.DONOR_NEIGHBOURHOOD_RADIUS_M = previous;
    } else {
      delete process.env.DONOR_NEIGHBOURHOOD_RADIUS_M;
    }
  }
});
