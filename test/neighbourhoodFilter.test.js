import test from "node:test";
import assert from "node:assert/strict";
import {
  filterRecordsByNeighbourhood,
  haversineDistanceM,
  intentMatchesNeighbourhood
} from "../src/neighbourhoodFilter.js";
import { FIXTURE_LOCALITY_POSTAL } from "./fixtures/standardOffersCatalog.js";

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

test("filterRecordsByNeighbourhood near scope includes other donors without GPS", () => {
  const records = [
    { user_id: "alice", pack_id: "a" },
    { user_id: "bob", pack_id: "b" }
  ];
  const filtered = filterRecordsByNeighbourhood(
    records,
    { type: "near", nearLat: 12.97, nearLng: 80.22, radiusM: 5000 },
    "alice",
    "donor"
  );
  assert.equal(filtered.length, 2);
});

test("intentMatchesNeighbourhood locality scope includes descendant postal keys", () => {
  const record = {
    location_lat: 12.94,
    location_lng: 80.24,
    locality_key: FIXTURE_LOCALITY_POSTAL
  };
  assert.equal(
    intentMatchesNeighbourhood(record, {
      type: "locality",
      localityKey: "IN:TN"
    }),
    true
  );
  assert.equal(
    intentMatchesNeighbourhood(record, {
      type: "locality",
      localityKey: "IN:KA"
    }),
    false
  );
});

test("intentMatchesNeighbourhood locality scope matches without GPS", () => {
  const record = {
    locality_key: FIXTURE_LOCALITY_POSTAL
  };
  assert.equal(
    intentMatchesNeighbourhood(record, {
      type: "locality",
      localityKey: "IN:TN"
    }),
    true
  );
});

test("filterRecordsByNeighbourhood locality includes rows without GPS", () => {
  const records = [
    { user_id: "bob", locality_key: FIXTURE_LOCALITY_POSTAL },
    { user_id: "carol", locality_key: "IN:KA:560001" }
  ];
  const filtered = filterRecordsByNeighbourhood(
    records,
    { type: "locality", localityKey: "IN:TN" },
    "",
    "coordinator"
  );
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].user_id, "bob");
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
