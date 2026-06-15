import test from "node:test";
import assert from "node:assert/strict";
import {
  buildConnectionHandoff,
  CONNECTION_SAFETY_COPY,
  resolveConnectionViewerRole
} from "../src/connectionHandoff.js";

const seekerDemand = {
  id: "sd-1",
  order_code: "SB-7K2M-9F3",
  initiation_route: "eco_kitchen_pledge",
  reported_by_user_id: "initiator-1",
  status: "recorded",
  meal_units: 4,
  standard_offer_id: "so-lunch",
  menu_label: "Lunch",
  price_inr: 120,
  need_description: "Lunch",
  locality_key: "IN:TN:600115",
  created_at: "2026-06-01T10:00:00Z",
  updated_at: "2026-06-01T10:00:00Z"
};

const kitchenCommitment = {
  id: "vb-1",
  submitted_by_user_id: "kitchen-1",
  locality_key: "IN:TN:600115",
  standard_offer_id: "so-lunch",
  vendor_name: "Green Kitchen",
  portions: 20,
  status: "submitted",
  commitment_status: "committed",
  order_code: "SB-7K2M-9F3",
  seeker_demand_id: "sd-1",
  created_at: "2026-06-01T11:00:00Z",
  updated_at: "2026-06-01T11:00:00Z"
};

test("resolveConnectionViewerRole identifies initiator and pledger", () => {
  assert.equal(
    resolveConnectionViewerRole("initiator-1", "donor", {
      seekerDemand,
      kitchenCommitment,
      pledges: [{ pledged_by_user_id: "pledger-1" }]
    }),
    "initiator"
  );
  assert.equal(
    resolveConnectionViewerRole("pledger-1", "donor", {
      seekerDemand,
      kitchenCommitment,
      pledges: [{ pledged_by_user_id: "pledger-1" }]
    }),
    "pledger"
  );
  assert.equal(
    resolveConnectionViewerRole("kitchen-1", "donor", {
      seekerDemand,
      kitchenCommitment,
      pledges: []
    }),
    "kitchen"
  );
  assert.equal(
    resolveConnectionViewerRole("stranger", "donor", {
      seekerDemand,
      kitchenCommitment,
      pledges: []
    }),
    null
  );
});

test("buildConnectionHandoff exposes kitchen email to self-pay initiator when ready", () => {
  const selfPayDemand = {
    ...seekerDemand,
    initiation_route: "eco_kitchen_self_pay"
  };
  const handoff = buildConnectionHandoff({
    orderCode: "SB-7K2M-9F3",
    seekerDemand: selfPayDemand,
    kitchenCommitment,
    pledgeRecords: [],
    emailByUserId: {
      "kitchen-1": "kitchen@example.com",
      "initiator-1": "initiator@example.com"
    },
    viewerRole: "initiator"
  });
  assert.equal(handoff.initiation_route, "eco_kitchen_self_pay");
  assert.equal(handoff.counterparty_email, "kitchen@example.com");
  assert.equal(handoff.pledgers, undefined);
});

test("buildConnectionHandoff exposes pledgers to kitchen on pledge route", () => {
  const handoff = buildConnectionHandoff({
    orderCode: "SB-7K2M-9F3",
    seekerDemand,
    kitchenCommitment,
    pledgeRecords: [
      {
        id: "pl-1",
        pledged_by_user_id: "pledger-1",
        locality_key: "IN:TN:600115",
        standard_offer_id: "so-lunch",
        meal_units: 2,
        status: "pledged",
        created_at: "2026-06-01T10:30:00Z",
        updated_at: "2026-06-01T10:30:00Z"
      }
    ],
    emailByUserId: {
      "kitchen-1": "kitchen@example.com",
      "pledger-1": "pledger@example.com"
    },
    viewerRole: "kitchen"
  });
  assert.equal(handoff.pledgers?.length, 1);
  assert.equal(handoff.pledgers?.[0]?.login_email, "pledger@example.com");
});

test("buildConnectionHandoff exposes kitchen email to initiator when ready", () => {
  const handoff = buildConnectionHandoff({
    orderCode: "SB-7K2M-9F3",
    seekerDemand,
    kitchenCommitment,
    pledgeRecords: [],
    emailByUserId: {
      "kitchen-1": "kitchen@example.com",
      "initiator-1": "initiator@example.com"
    },
    viewerRole: "initiator"
  });
  assert.equal(handoff.status, "ready");
  assert.equal(handoff.safety_copy, CONNECTION_SAFETY_COPY);
  assert.equal(handoff.kitchen?.login_email, "kitchen@example.com");
  assert.equal(handoff.counterparty_email, "kitchen@example.com");
  assert.equal(handoff.kitchen?.display_name, "Green Kitchen");
});

test("buildConnectionHandoff hides emails until kitchen commits", () => {
  const handoff = buildConnectionHandoff({
    orderCode: "SB-7K2M-9F3",
    seekerDemand,
    kitchenCommitment: null,
    pledgeRecords: [],
    emailByUserId: {},
    viewerRole: "initiator"
  });
  assert.equal(handoff.status, "pending_kitchen");
  assert.equal(handoff.kitchen, null);
});
