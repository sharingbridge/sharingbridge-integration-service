import test from "node:test";
import assert from "node:assert/strict";
import {
  filterRecordsByNeighbourhood,
  haversineDistanceM,
  intentMatchesNeighbourhood
} from "../src/neighbourhoodFilter.js";

test("haversineDistanceM is zero for same point", () => {
  assert.equal(haversineDistanceM(12.97, 80.22, 12.97, 80.22), 0);
});

test("intentMatchesNeighbourhood uses radius", () => {
  const record = {
    location_lat: 12.97,
    location_lng: 80.22,
    locality_key: "12.97,80.22"
  };
  assert.equal(
    intentMatchesNeighbourhood(record, {
      type: "near",
      nearLat: 12.97,
      nearLng: 80.22,
      radiusM: 500
    }),
    true
  );
  assert.equal(
    intentMatchesNeighbourhood(record, {
      type: "near",
      nearLat: 13.5,
      nearLng: 81,
      radiusM: 1000
    }),
    false
  );
});

test("filterRecordsByNeighbourhood keeps viewer own rows without geo on intent", () => {
  const records = [
    { user_id: "alice", pack_id: "a" },
    {
      user_id: "bob",
      location_lat: 12.97,
      location_lng: 80.22,
      locality_key: "12.97,80.22"
    }
  ];
  const filtered = filterRecordsByNeighbourhood(records, null, "alice", "donor");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].user_id, "alice");
});
