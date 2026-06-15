import { isValidOrderCode } from "./orderCode.js";
import { INITIATION_ROUTES } from "./initiationRoutes.js";
import { formatSeekerDemandForApi } from "./seekerDemands.js";
import { formatPledgeForApi, formatVendorBidForApi } from "./marketplace.js";
import { isCoordinatorApiRole } from "./orderIntentViews.js";

export const CONNECTION_SAFETY_COPY =
  "Confirm this order code in SharingBridge before paying anyone. We never send payment links or QR codes by email.";

function pledgesForDemand(pledgeRecords, seekerDemand) {
  const locality = String(seekerDemand.locality_key ?? "").trim();
  const offerId = String(seekerDemand.standard_offer_id ?? "").trim();
  return pledgeRecords.filter(
    (row) =>
      String(row.locality_key ?? "").trim() === locality &&
      String(row.standard_offer_id ?? "").trim() === offerId
  );
}

export function resolveConnectionViewerRole(
  authUserId,
  authRole,
  { seekerDemand, kitchenCommitment, pledges }
) {
  if (isCoordinatorApiRole(authRole)) {
    return "coordinator";
  }
  if (kitchenCommitment?.submitted_by_user_id === authUserId) {
    return "kitchen";
  }
  if (seekerDemand?.reported_by_user_id === authUserId) {
    return "initiator";
  }
  if (pledges.some((row) => row.pledged_by_user_id === authUserId)) {
    return "pledger";
  }
  return null;
}

export function buildConnectionHandoff({
  orderCode,
  seekerDemand,
  kitchenCommitment,
  pledgeRecords,
  emailByUserId,
  viewerRole
}) {
  const demandApi = seekerDemand ? formatSeekerDemandForApi(seekerDemand) : null;
  const kitchenApi = kitchenCommitment
    ? formatVendorBidForApi(kitchenCommitment)
    : null;
  const pledgesApi = pledgeRecords.map(formatPledgeForApi);

  const status = kitchenCommitment ? "ready" : "pending_kitchen";

  const initiatorEmail =
    emailByUserId[seekerDemand?.reported_by_user_id ?? ""] ?? null;
  const kitchenEmail =
    emailByUserId[kitchenCommitment?.submitted_by_user_id ?? ""] ?? null;

  const pledgers = pledgesApi
    .map((row) => ({
      pledged_by_user_id: row.pledged_by_user_id ?? null,
      meal_units: row.meal_units,
      login_email: emailByUserId[row.pledged_by_user_id ?? ""] ?? null
    }))
    .filter((row) => row.login_email);

  const base = {
    order_code: orderCode,
    status,
    initiation_route:
      demandApi?.initiation_route ?? INITIATION_ROUTES.ECO_KITCHEN_PLEDGE,
    viewer_role: viewerRole,
    safety_copy: CONNECTION_SAFETY_COPY,
    menu_label: demandApi?.menu_label ?? kitchenApi?.menu_label ?? "",
    meal_units: demandApi?.meal_units ?? null,
    price_inr: demandApi?.price_inr ?? null,
    locality_key: demandApi?.locality_key ?? kitchenApi?.locality_key ?? "",
    seeker_demand_id: demandApi?.seeker_demand_id ?? null
  };

  if (status !== "ready") {
    return {
      ...base,
      kitchen: kitchenApi
        ? { display_name: kitchenApi.vendor_name, commitment_status: "pending" }
        : null
    };
  }

  if (viewerRole === "kitchen" || viewerRole === "coordinator") {
    return {
      ...base,
      kitchen: {
        display_name: kitchenApi?.vendor_name ?? "",
        login_email: kitchenEmail
      },
      initiator: initiatorEmail ? { login_email: initiatorEmail } : null,
      pledgers
    };
  }

  if (viewerRole === "initiator" || viewerRole === "pledger") {
    return {
      ...base,
      kitchen: {
        display_name: kitchenApi?.vendor_name ?? "",
        login_email: kitchenEmail
      },
      counterparty_email: kitchenEmail
    };
  }

  return base;
}

export async function resolveOrderConnection({
  orderCode,
  authUserId,
  authRole,
  seekerDemandStore,
  marketplaceStore,
  lookupEmails
}) {
  const trimmed = String(orderCode ?? "").trim();
  if (!isValidOrderCode(trimmed)) {
    const error = new Error("order_code must match SB-XXXX-XXX.");
    error.status = 400;
    error.code = "invalid_order_code";
    throw error;
  }

  if (!seekerDemandStore?.findByOrderCode) {
    const error = new Error(
      "Order lookup is not available until Eco Kitchen Phase 3 migration is applied."
    );
    error.status = 503;
    error.code = "connection_schema_pending";
    throw error;
  }

  const seekerDemand = await seekerDemandStore.findByOrderCode(trimmed);
  if (!seekerDemand) {
    const error = new Error(`No initiation found for order ${trimmed}.`);
    error.status = 404;
    error.code = "order_not_found";
    throw error;
  }

  const kitchenCommitment = marketplaceStore?.findKitchenCommitmentByOrderCode
    ? await marketplaceStore.findKitchenCommitmentByOrderCode(trimmed)
    : null;

  const pledgeRecords =
    marketplaceStore?.listPledges && seekerDemand
      ? pledgesForDemand(
          await marketplaceStore.listPledges({ limit: 200 }),
          seekerDemand
        )
      : [];

  const viewerRole = resolveConnectionViewerRole(authUserId, authRole, {
    seekerDemand,
    kitchenCommitment,
    pledges: pledgeRecords
  });

  if (!viewerRole) {
    const error = new Error(
      "You are not a party on this order. Only the initiator, pledgers, kitchen, or a coordinator can view the connection."
    );
    error.status = 403;
    error.code = "connection_forbidden";
    throw error;
  }

  const userIds = new Set();
  if (seekerDemand.reported_by_user_id) {
    userIds.add(seekerDemand.reported_by_user_id);
  }
  if (kitchenCommitment?.submitted_by_user_id) {
    userIds.add(kitchenCommitment.submitted_by_user_id);
  }
  for (const pledge of pledgeRecords) {
    if (pledge.pledged_by_user_id) {
      userIds.add(pledge.pledged_by_user_id);
    }
  }

  const emailByUserId = lookupEmails
    ? await lookupEmails([...userIds])
    : {};

  const connection = buildConnectionHandoff({
    orderCode: trimmed,
    seekerDemand,
    kitchenCommitment,
    pledgeRecords,
    emailByUserId,
    viewerRole
  });

  return { connection };
}
