import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveLocalityKey,
  deriveLocalityKeyFromBucketKm,
  getDonorLocalityBucketKm,
  getDonorNeighbourhoodRadiusM,
  parseDonorLocalityBucketKm,
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

test("parseDonorLocalityBucketKm accepts km and clamps range", () => {
  assert.equal(parseDonorLocalityBucketKm(undefined), null);
  assert.equal(parseDonorLocalityBucketKm("5"), 5);
  assert.equal(parseDonorLocalityBucketKm("0.1"), 0.5);
  assert.equal(parseDonorLocalityBucketKm("99"), 50);
});

test("deriveLocalityKeyFromBucketKm groups nearby Chennai points", () => {
  const a = deriveLocalityKeyFromBucketKm(12.944, 80.241, 5);
  const b = deriveLocalityKeyFromBucketKm(12.946, 80.243, 5);
  const far = deriveLocalityKeyFromBucketKm(13.05, 80.35, 5);
  assert.equal(a, b);
  assert.notEqual(a, far);
});

test("deriveLocalityKey prefers DONOR_LOCALITY_BUCKET_KM over grid decimals", () => {
  const prevBucket = process.env.DONOR_LOCALITY_BUCKET_KM;
  const prevDecimals = process.env.DONOR_LOCALITY_GRID_DECIMALS;
  process.env.DONOR_LOCALITY_BUCKET_KM = "5";
  process.env.DONOR_LOCALITY_GRID_DECIMALS = "2";
  try {
    assert.equal(
      deriveLocalityKey(12.944, 80.241),
      deriveLocalityKeyFromBucketKm(12.944, 80.241, 5)
    );
    assert.equal(getDonorLocalityBucketKm(), 5);
  } finally {
    if (prevBucket != null) {
      process.env.DONOR_LOCALITY_BUCKET_KM = prevBucket;
    } else {
      delete process.env.DONOR_LOCALITY_BUCKET_KM;
    }
    if (prevDecimals != null) {
      process.env.DONOR_LOCALITY_GRID_DECIMALS = prevDecimals;
    } else {
      delete process.env.DONOR_LOCALITY_GRID_DECIMALS;
    }
  }
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
