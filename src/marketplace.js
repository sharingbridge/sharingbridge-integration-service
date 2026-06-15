import { aggregateDemandByStandardOffer } from "./seekerDemands.js";
import { offerBucketKey } from "./standardOffers.js";
import { emailShareConsentTimestamp, validateEmailShareConsent } from "./emailShareConsent.js";

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseUnits(value, max = 50) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) {
    return null;
  }
  return Math.min(max, Math.round(n));
}

export function validateCreatePledgeRequest(payload) {
  if (!payload || typeof payload !== "object") {
    return "Request body must be a JSON object.";
  }
  if (!isNonEmptyString(payload.locality_key)) {
    return "locality_key is required.";
  }
  if (!isNonEmptyString(payload.standard_offer_id)) {
    return "standard_offer_id is required.";
  }
  const units = parseUnits(payload.meal_units ?? 1);
  if (payload.meal_units != null && units == null) {
    return "meal_units must be a positive integer up to 50.";
  }
  const consentError = validateEmailShareConsent(payload);
  if (consentError) {
    return consentError;
  }
  return null;
}

export function validateCreateVendorBidRequest(payload) {
  if (!payload || typeof payload !== "object") {
    return "Request body must be a JSON object.";
  }
  if (!isNonEmptyString(payload.locality_key)) {
    return "locality_key is required.";
  }
  if (!isNonEmptyString(payload.standard_offer_id)) {
    return "standard_offer_id is required.";
  }
  if (!isNonEmptyString(payload.vendor_name)) {
    return "vendor_name is required.";
  }
  const portions = parseUnits(payload.portions, 500);
  if (portions == null) {
    return "portions must be a positive integer up to 500.";
  }
  const consentError = validateEmailShareConsent(payload);
  if (consentError) {
    return consentError;
  }
  return null;
}

export function buildPledgeRecord(payload, { pledgedByUserId }) {
  const now = new Date().toISOString();
  return {
    id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    pledged_by_user_id: pledgedByUserId,
    demand_window_id:
      typeof payload.demand_window_id === "string"
        ? payload.demand_window_id.trim()
        : "",
    locality_key: payload.locality_key.trim(),
    standard_offer_id: payload.standard_offer_id.trim(),
    menu_label:
      typeof payload.menu_label === "string" ? payload.menu_label.trim() : "",
    meal_units: parseUnits(payload.meal_units ?? 1) ?? 1,
    status: "pledged",
    email_share_consent_at: emailShareConsentTimestamp(payload),
    created_at: now,
    updated_at: now
  };
}

export function buildVendorBidRecord(payload, { submittedByUserId }) {
  const now = new Date().toISOString();
  return {
    id: `vb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    submitted_by_user_id: submittedByUserId,
    demand_window_id:
      typeof payload.demand_window_id === "string"
        ? payload.demand_window_id.trim()
        : "",
    locality_key: payload.locality_key.trim(),
    standard_offer_id: payload.standard_offer_id.trim(),
    menu_label:
      typeof payload.menu_label === "string" ? payload.menu_label.trim() : "",
    vendor_name: payload.vendor_name.trim(),
    portions: parseUnits(payload.portions, 500) ?? 1,
    notes: typeof payload.notes === "string" ? payload.notes.trim() : "",
    status: "submitted",
    commitment_status: "committed",
    seeker_demand_id:
      typeof payload.seeker_demand_id === "string"
        ? payload.seeker_demand_id.trim()
        : null,
    order_code:
      typeof payload.order_code === "string" ? payload.order_code.trim() : null,
    email_share_consent_at: emailShareConsentTimestamp(payload),
    created_at: now,
    updated_at: now
  };
}

export function formatPledgeForApi(record) {
  return {
    pledge_id: record.id,
    pledged_by_user_id: record.pledged_by_user_id,
    demand_window_id: record.demand_window_id || null,
    locality_key: record.locality_key,
    standard_offer_id: record.standard_offer_id ?? null,
    menu_label: record.menu_label ?? "",
    meal_units: record.meal_units,
    status: record.status,
    email_share_consent_at: record.email_share_consent_at ?? null,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

export function formatVendorBidForApi(record) {
  return {
    vendor_bid_id: record.id,
    submitted_by_user_id: record.submitted_by_user_id,
    demand_window_id: record.demand_window_id || null,
    locality_key: record.locality_key,
    standard_offer_id: record.standard_offer_id ?? null,
    menu_label: record.menu_label ?? "",
    vendor_name: record.vendor_name,
    portions: record.portions,
    notes: record.notes ?? "",
    status: record.status,
    commitment_status: record.commitment_status ?? "submitted",
    seeker_demand_id: record.seeker_demand_id ?? null,
    order_code: record.order_code ?? null,
    email_share_consent_at: record.email_share_consent_at ?? null,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

function sumUnitsByOfferBucket(rows, valueKey) {
  const byKey = new Map();
  for (const row of rows) {
    const key = offerBucketKey(
      row.locality_key,
      row.standard_offer_id || "legacy"
    );
    const amount = Number(row[valueKey]) || 0;
    byKey.set(key, (byKey.get(key) ?? 0) + amount);
  }
  return byKey;
}

export function activeOfferBucketsFromSeekerDemands(seekerDemandsFormatted) {
  return aggregateDemandByStandardOffer(seekerDemandsFormatted).map((window) => ({
    bucket_key: window.bucket_key,
    locality_key: window.locality_key,
    standard_offer_id: window.standard_offer_id,
    menu_label: window.menu_label,
    price_inr: window.price_inr
  }));
}

/** Reject pledges/bids that do not match a live demand line (area + standard item). */
export function validateMarketplaceOfferSelection(
  localityKey,
  standardOfferId,
  activeBuckets
) {
  const trimmedLocality = String(localityKey ?? "").trim();
  const trimmedOffer = String(standardOfferId ?? "").trim();
  if (!trimmedLocality) {
    return "locality_key is required.";
  }
  if (!trimmedOffer) {
    return "standard_offer_id is required.";
  }
  if (!Array.isArray(activeBuckets) || activeBuckets.length === 0) {
    return "No demand lines yet. Record seeker demand with a standard menu item first.";
  }
  const match = activeBuckets.find(
    (bucket) =>
      bucket.locality_key === trimmedLocality &&
      bucket.standard_offer_id === trimmedOffer
  );
  if (!match) {
    const options = activeBuckets
      .filter((bucket) => bucket.standard_offer_id)
      .map(
        (bucket) =>
          `${bucket.menu_label} @ ${bucket.locality_key} (${bucket.standard_offer_id})`
      )
      .join("; ");
    return `No matching demand line for that menu item. Active lines: ${options || "none with standard_offer_id"}`;
  }
  return null;
}

export function tagMarketplaceOfferMatch(rows, activeBuckets) {
  const keys = new Set(activeBuckets.map((bucket) => bucket.bucket_key));
  return rows.map((row) => ({
    ...row,
    matches_demand_bucket: keys.has(
      offerBucketKey(row.locality_key, row.standard_offer_id || "legacy")
    )
  }));
}

function allocationHintForWindow(window) {
  const unmet = Number(window.unmet_demand_units) || 0;
  const supplyGap = Number(window.supply_gap_units) || 0;
  if (unmet > 0) {
    return "needs_pledges";
  }
  if (supplyGap > 0) {
    return "needs_vendor_bids";
  }
  return "balanced";
}

/**
 * Wave 2–3 — read-only supply/demand gap per aggregated locality bucket.
 * Full allocation (assign pledges to vendors) is Phase I.
 */
export function enrichDemandWindowsWithSupply(
  demandWindows,
  pledges,
  vendorBids
) {
  const pledgedByKey = sumUnitsByOfferBucket(pledges, "meal_units");
  const bidByKey = sumUnitsByOfferBucket(vendorBids, "portions");

  return demandWindows.map((window) => {
    const bucketKey =
      window.bucket_key ??
      offerBucketKey(window.locality_key, window.standard_offer_id || "legacy");
    const pledged = pledgedByKey.get(bucketKey) ?? 0;
    const bidPortions = bidByKey.get(bucketKey) ?? 0;
    const demand = Number(window.meal_units_total) || 0;
    const enriched = {
      ...window,
      pledged_units_total: pledged,
      bid_portions_total: bidPortions,
      unmet_demand_units: Math.max(0, demand - pledged),
      supply_gap_units: Math.max(0, demand - bidPortions)
    };
    return {
      ...enriched,
      allocation_hint: allocationHintForWindow(enriched)
    };
  });
}
