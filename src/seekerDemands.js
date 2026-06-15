import { offerBucketKey } from "./standardOffers.js";
import { generateOrderCode } from "./orderCode.js";
import {
  INITIATION_ROUTES,
  resolveSeekerDemandRoute
} from "./initiationRoutes.js";
import {
  emailShareConsentTimestamp,
  validateEmailShareConsent
} from "./emailShareConsent.js";

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
  if (!isNonEmptyString(payload.standard_offer_id)) {
    return "standard_offer_id is required. Choose a standard menu item for this area.";
  }
  const units = parseMealUnits(payload.meal_units);
  if (payload.meal_units != null && units == null) {
    return "meal_units must be a positive integer up to 50.";
  }
  const consentError = validateEmailShareConsent(payload);
  if (consentError) {
    return consentError;
  }
  return null;
}

export function buildSeekerDemandRecord(
  payload,
  { reportedByUserId, standardOffer }
) {
  const now = new Date().toISOString();
  const mealUnits = parseMealUnits(payload.meal_units) ?? 1;
  const verbalNotes =
    typeof payload.verbal_notes === "string" ? payload.verbal_notes.trim() : "";
  const menuLabel = String(standardOffer?.menu_label ?? "").trim();

  return {
    id: `sd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    order_code: generateOrderCode(),
    initiation_route: resolveSeekerDemandRoute(payload),
    initiator_email_share_consent_at: emailShareConsentTimestamp(payload),
    reported_by_user_id: reportedByUserId,
    status: "recorded",
    meal_units: mealUnits,
    standard_offer_id: standardOffer.id,
    menu_label: menuLabel,
    price_inr:
      standardOffer?.price_inr == null ? null : Number(standardOffer.price_inr),
    need_description: menuLabel,
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
    order_code: record.order_code ?? null,
    initiation_route:
      record.initiation_route ?? INITIATION_ROUTES.ECO_KITCHEN_PLEDGE,
    reported_by_user_id: record.reported_by_user_id ?? null,
    status: record.status,
    meal_units: record.meal_units,
    standard_offer_id: record.standard_offer_id ?? null,
    menu_label: record.menu_label ?? record.need_description ?? "",
    price_inr:
      typeof record.price_inr === "number" ? record.price_inr : null,
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

/** Aggregate by GPS bucket + standard menu item (not free-text need_description). */
export function aggregateDemandByStandardOffer(seekerDemands) {
  const byKey = new Map();
  for (const row of seekerDemands) {
    const locality =
      (row.locality_key && String(row.locality_key).trim()) || "unknown";
    const offerId = row.standard_offer_id
      ? String(row.standard_offer_id).trim()
      : "legacy";
    const bucket = offerBucketKey(locality, offerId);
    const entry = byKey.get(bucket) ?? {
      bucket_key: bucket,
      locality_key: locality,
      standard_offer_id: offerId === "legacy" ? null : offerId,
      menu_label:
        row.menu_label ||
        row.need_description ||
        (offerId === "legacy" ? "Legacy free-text demand" : "Standard item"),
      price_inr: typeof row.price_inr === "number" ? row.price_inr : null,
      demand_count: 0,
      meal_units_total: 0,
      latest_at: row.updated_at
    };
    entry.demand_count += 1;
    entry.meal_units_total += Number(row.meal_units) || 1;
    if (String(row.updated_at) > String(entry.latest_at)) {
      entry.latest_at = row.updated_at;
    }
    byKey.set(bucket, entry);
  }
  return [...byKey.values()].sort((a, b) => {
    if (a.locality_key !== b.locality_key) {
      return a.locality_key.localeCompare(b.locality_key);
    }
    return b.meal_units_total - a.meal_units_total;
  });
}
