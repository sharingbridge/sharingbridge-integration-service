import { aggregateDemandByLocality } from "./seekerDemands.js";

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
  const units = parseUnits(payload.meal_units ?? 1);
  if (payload.meal_units != null && units == null) {
    return "meal_units must be a positive integer up to 50.";
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
  if (!isNonEmptyString(payload.vendor_name)) {
    return "vendor_name is required.";
  }
  const portions = parseUnits(payload.portions, 500);
  if (portions == null) {
    return "portions must be a positive integer up to 500.";
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
    meal_units: parseUnits(payload.meal_units ?? 1) ?? 1,
    status: "pledged",
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
    vendor_name: payload.vendor_name.trim(),
    portions: parseUnits(payload.portions, 500) ?? 1,
    notes: typeof payload.notes === "string" ? payload.notes.trim() : "",
    status: "submitted",
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
    meal_units: record.meal_units,
    status: record.status,
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
    vendor_name: record.vendor_name,
    portions: record.portions,
    notes: record.notes ?? "",
    status: record.status,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

function sumUnitsByLocality(rows, valueKey) {
  const byKey = new Map();
  for (const row of rows) {
    const key =
      (row.locality_key && String(row.locality_key).trim()) || "unknown";
    const amount = Number(row[valueKey]) || 0;
    byKey.set(key, (byKey.get(key) ?? 0) + amount);
  }
  return byKey;
}

export function activeLocalityKeysFromSeekerDemands(seekerDemandsFormatted) {
  return aggregateDemandByLocality(seekerDemandsFormatted).map(
    (window) => window.locality_key
  );
}

/** Reject free-text place names that do not match a live demand bucket. */
export function validateMarketplaceLocalityKey(localityKey, activeKeys) {
  const trimmed = String(localityKey ?? "").trim();
  if (!trimmed) {
    return "locality_key is required.";
  }
  if (!Array.isArray(activeKeys) || activeKeys.length === 0) {
    return "No demand buckets yet. Record seeker demand with GPS on mobile first.";
  }
  if (!activeKeys.includes(trimmed)) {
    return `locality_key must match an active demand bucket. Choose one of: ${activeKeys.join(", ")}`;
  }
  return null;
}

export function tagMarketplaceLocalityMatch(rows, activeKeys) {
  const set = new Set(activeKeys);
  return rows.map((row) => ({
    ...row,
    matches_demand_bucket: set.has(row.locality_key)
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
  const pledgedByKey = sumUnitsByLocality(pledges, "meal_units");
  const bidByKey = sumUnitsByLocality(vendorBids, "portions");

  return demandWindows.map((window) => {
    const pledged = pledgedByKey.get(window.locality_key) ?? 0;
    const bidPortions = bidByKey.get(window.locality_key) ?? 0;
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
