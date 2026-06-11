import { formatOrderIntentForApi } from "./orderIntents.js";
import { getDonorNeighbourhoodWindowMs } from "./donorNeighbourhoodWindow.js";

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
  return age >= 0 && age <= getDonorNeighbourhoodWindowMs();
}

function isOwnIntent(record, viewerUserId) {
  const owner = typeof record?.user_id === "string" ? record.user_id.trim() : "";
  const viewer =
    typeof viewerUserId === "string" ? viewerUserId.trim() : "";
  return owner.length > 0 && viewer.length > 0 && owner === viewer;
}

/** Limited dashboard: redact others' coordinates; keep viewer's own pins. */
export function formatOrderIntentLimited(
  record,
  nowMs = Date.now(),
  viewerUserId = ""
) {
  const base = formatOrderIntentForApi(record);
  const keepCoords = isOwnIntent(record, viewerUserId);
  const localized = {
    ...base,
    location_lat: keepCoords ? base.location_lat : null,
    location_lng: keepCoords ? base.location_lng : null
  };
  if (!referencePhotoWithinViewerWindow(record, nowMs)) {
    return {
      ...localized,
      has_reference_photo: false,
      reference_photo_artifact_id: "",
      reference_photo_view_url: "",
      reference_photo_thumbnail_url: ""
    };
  }
  return localized;
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
  const email = donorEmail || null;
  return {
    ...base,
    /** @deprecated use initiator_email */
    donor_email: email,
    initiator_email: email
  };
}

export function formatOrderIntentForRole(
  record,
  role,
  options = {}
) {
  const {
    donorEmailByUserId = {},
    nowMs = Date.now(),
    viewerUserId = ""
  } = options;
  return isCoordinatorApiRole(role)
    ? formatOrderIntentCoordinator(record, donorEmailByUserId, nowMs)
    : formatOrderIntentLimited(record, nowMs, viewerUserId);
}

export async function formatOrderIntentsForRole(records, role, options = {}) {
  return records.map((record) => formatOrderIntentForRole(record, role, options));
}
