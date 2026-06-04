import assert from "node:assert/strict";
import test from "node:test";
import {
  getDonorNeighbourhoodRadiusM,
  parseDonorNeighbourhoodRadiusM
} from "../src/donorNeighbourhoodArea.js";

test("parseDonorNeighbourhoodRadiusM defaults and clamps", () => {
  assert.equal(parseDonorNeighbourhoodRadiusM(undefined), 5000);
  assert.equal(parseDonorNeighbourhoodRadiusM(100), 500);
  assert.equal(parseDonorNeighbourhoodRadiusM(99_999), 50_000);
});

test("getDonorNeighbourhoodRadiusM prefers DONOR_NEIGHBOURHOOD_RADIUS_M", () => {
  const prevM = process.env.DONOR_NEIGHBOURHOOD_RADIUS_M;
  const prevKm = process.env.DONOR_NEIGHBOURHOOD_RADIUS_KM;
  process.env.DONOR_NEIGHBOURHOOD_RADIUS_M = "3000";
  delete process.env.DONOR_NEIGHBOURHOOD_RADIUS_KM;
  try {
    assert.equal(getDonorNeighbourhoodRadiusM(), 3000);
  } finally {
    if (prevM != null) {
      process.env.DONOR_NEIGHBOURHOOD_RADIUS_M = prevM;
    } else {
      delete process.env.DONOR_NEIGHBOURHOOD_RADIUS_M;
    }
    if (prevKm != null) {
      process.env.DONOR_NEIGHBOURHOOD_RADIUS_KM = prevKm;
    }
  }
});

test("getDonorNeighbourhoodRadiusM falls back to legacy KM env", () => {
  const prevM = process.env.DONOR_NEIGHBOURHOOD_RADIUS_M;
  const prevKm = process.env.DONOR_NEIGHBOURHOOD_RADIUS_KM;
  delete process.env.DONOR_NEIGHBOURHOOD_RADIUS_M;
  process.env.DONOR_NEIGHBOURHOOD_RADIUS_KM = "5";
  try {
    assert.equal(getDonorNeighbourhoodRadiusM(), 5000);
  } finally {
    if (prevM != null) {
      process.env.DONOR_NEIGHBOURHOOD_RADIUS_M = prevM;
    } else {
      delete process.env.DONOR_NEIGHBOURHOOD_RADIUS_M;
    }
    if (prevKm != null) {
      process.env.DONOR_NEIGHBOURHOOD_RADIUS_KM = prevKm;
    } else {
      delete process.env.DONOR_NEIGHBOURHOOD_RADIUS_KM;
    }
  }
});
