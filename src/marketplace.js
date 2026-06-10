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
