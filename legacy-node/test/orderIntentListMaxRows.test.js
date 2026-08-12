import assert from "node:assert/strict";
import test from "node:test";
import { getOrderIntentListMaxRows } from "../src/orderIntentListMaxRows.js";

test("getOrderIntentListMaxRows defaults to 100", () => {
  const previous = process.env.ORDER_INTENT_LIST_MAX_ROWS;
  delete process.env.ORDER_INTENT_LIST_MAX_ROWS;
  try {
    assert.equal(getOrderIntentListMaxRows(), 100);
  } finally {
    if (previous != null) {
      process.env.ORDER_INTENT_LIST_MAX_ROWS = previous;
    }
  }
});

test("getOrderIntentListMaxRows clamps invalid values", () => {
  const previous = process.env.ORDER_INTENT_LIST_MAX_ROWS;
  process.env.ORDER_INTENT_LIST_MAX_ROWS = "9999";
  try {
    assert.equal(getOrderIntentListMaxRows(), 500);
  } finally {
    if (previous != null) {
      process.env.ORDER_INTENT_LIST_MAX_ROWS = previous;
    } else {
      delete process.env.ORDER_INTENT_LIST_MAX_ROWS;
    }
  }
});
