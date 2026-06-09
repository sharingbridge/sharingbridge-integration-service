function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseMealUnits(value) {
  if (value == null) {
    return 1;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) {
    return null;
  }
  return Math.min(50, Math.round(n));
}

export function validateCreateSeekerDemandRequest(payload) {
  if (!payload || typeof payload !== "object") {
    return "Request body must be a JSON object.";
  }
  if (!isNonEmptyString(payload.need_description)) {
    return "need_description is required.";
  }
  const units = parseMealUnits(payload.meal_units);
  if (payload.meal_units != null && units == null) {
    return "meal_units must be a positive integer up to 50.";
  }
  return null;
}

export function buildSeekerDemandRecord(payload, { reportedByUserId }) {
  const now = new Date().toISOString();
  const mealUnits = parseMealUnits(payload.meal_units) ?? 1;
  const verbalNotes =
    typeof payload.verbal_notes === "string" ? payload.verbal_notes.trim() : "";

  return {
    id: `sd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    reported_by_user_id: reportedByUserId,
    status: "recorded",
    meal_units: mealUnits,
    need_description: payload.need_description.trim(),
    verbal_notes: verbalNotes,
    location_lat: null,
    location_lng: null,
    location_label: "",
    locality_key: "",
    created_at: now,
    updated_at: now
  };
}

export function formatSeekerDemandForApi(record) {
  return {
    seeker_demand_id: record.id,
    reported_by_user_id: record.reported_by_user_id ?? null,
    status: record.status,
    meal_units: record.meal_units,
    need_description: record.need_description,
    verbal_notes: record.verbal_notes ?? "",
    location_lat:
      typeof record.location_lat === "number" ? record.location_lat : null,
    location_lng:
      typeof record.location_lng === "number" ? record.location_lng : null,
    location_label: record.location_label ?? "",
    locality_key: record.locality_key ?? "",
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

export function aggregateDemandByLocality(seekerDemands) {
  const byKey = new Map();
  for (const row of seekerDemands) {
    const key =
      (row.locality_key && String(row.locality_key).trim()) || "unknown";
    const entry = byKey.get(key) ?? {
      locality_key: key,
      demand_count: 0,
      meal_units_total: 0,
      latest_at: row.updated_at
    };
    entry.demand_count += 1;
    entry.meal_units_total += Number(row.meal_units) || 1;
    if (String(row.updated_at) > String(entry.latest_at)) {
      entry.latest_at = row.updated_at;
    }
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort(
    (a, b) => b.meal_units_total - a.meal_units_total
  );
}
