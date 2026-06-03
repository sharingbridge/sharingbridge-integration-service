import { formatOrderIntentForApi } from "./orderIntents.js";

/** Reference photos visible to non-coordinator dashboard viewers only within this window. */
export const REFERENCE_PHOTO_MAX_AGE_MS = 60 * 60 * 1000;

export function isCoordinatorApiRole(role) {
  return role === "coordinator";
}

function intentTimestampMs(record) {
  const raw = record.updated_at || record.created_at;
  const ms = Date.parse(raw || "");
  return Number.isNaN(ms) ? 0 : ms;
}

export function referencePhotoWithinViewerWindow(record, nowMs = Date.now()) {
  if (!record.has_reference_photo) {
    return false;
  }
  const age = nowMs - intentTimestampMs(record);
  return age >= 0 && age <= REFERENCE_PHOTO_MAX_AGE_MS;
}

/** Limited dashboard: neighbourhood list without reference photo URLs older than 1 hour. */
export function formatOrderIntentLimited(record, nowMs = Date.now()) {
  const base = formatOrderIntentForApi(record);
  if (!referencePhotoWithinViewerWindow(record, nowMs)) {
    return {
      ...base,
      has_reference_photo: false,
      reference_photo_artifact_id: "",
      reference_photo_view_url: "",
      reference_photo_thumbnail_url: ""
    };
  }
  return base;
}

/** Coordinator view: full intent plus donor email when known (never for limited dashboard). */
export function formatOrderIntentCoordinator(
  record,
  donorEmailByUserId = {},
  nowMs = Date.now()
) {
  const base = formatOrderIntentForApi(record);
  const userId = typeof base.user_id === "string" ? base.user_id.trim() : "";
  const donorEmail =
    userId && typeof donorEmailByUserId[userId] === "string"
      ? donorEmailByUserId[userId].trim()
      : "";
  return {
    ...base,
    donor_email: donorEmail || null
  };
}

export function formatOrderIntentForRole(
  record,
  role,
  options = {}
) {
  const { donorEmailByUserId = {}, nowMs = Date.now() } = options;
  return isCoordinatorApiRole(role)
    ? formatOrderIntentCoordinator(record, donorEmailByUserId, nowMs)
    : formatOrderIntentLimited(record, nowMs);
}

export async function formatOrderIntentsForRole(records, role, options = {}) {
  return records.map((record) => formatOrderIntentForRole(record, role, options));
}
