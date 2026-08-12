import test from "node:test";
import assert from "node:assert/strict";
import {
  getDonorNeighbourhoodSinceQuery,
  getDonorNeighbourhoodWindowHours,
  getDonorNeighbourhoodWindowMs,
  parseDonorNeighbourhoodWindowHours
} from "../src/donorNeighbourhoodWindow.js";

test("parseDonorNeighbourhoodWindowHours clamps and defaults", () => {
  assert.equal(parseDonorNeighbourhoodWindowHours(undefined), 2);
  assert.equal(parseDonorNeighbourhoodWindowHours("4"), 4);
  assert.equal(parseDonorNeighbourhoodWindowHours("0"), 1);
  assert.equal(parseDonorNeighbourhoodWindowHours("999"), 72);
  assert.equal(parseDonorNeighbourhoodWindowHours("nope"), 2);
});

test("getDonorNeighbourhoodWindowHours reads env", () => {
  const previous = process.env.DONOR_NEIGHBOURHOOD_WINDOW_HOURS;
  process.env.DONOR_NEIGHBOURHOOD_WINDOW_HOURS = "3";
  try {
    assert.equal(getDonorNeighbourhoodWindowHours(), 3);
    assert.equal(getDonorNeighbourhoodWindowMs(), 3 * 3_600_000);
    assert.equal(getDonorNeighbourhoodSinceQuery(), "3h");
  } finally {
    if (previous === undefined) {
      delete process.env.DONOR_NEIGHBOURHOOD_WINDOW_HOURS;
    } else {
      process.env.DONOR_NEIGHBOURHOOD_WINDOW_HOURS = previous;
    }
  }
});
