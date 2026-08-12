import { isCoordinatorApiRole } from "./orderIntentViews.js";
import {
  getDonorNeighbourhoodSinceQuery,
  getDonorNeighbourhoodWindowMs
} from "./donorNeighbourhoodWindow.js";

export { getDonorNeighbourhoodSinceQuery, getDonorNeighbourhoodWindowMs };

/** Default list window for limited (donor) dashboard — matches photo redaction window. */
export function getDonorListSinceMs() {
  return getDonorNeighbourhoodWindowMs();
}

/** Own-initiation history on mobile / initiator dashboard (no neighbourhood scope). */
export function getInitiatorHistorySinceMs() {
  return 7 * 86_400_000;
}

export function intentActivityMs(record) {
  const raw = record.updated_at || record.created_at;
  const ms = Date.parse(raw || "");
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Parse `since` query values such as `1h`, `30m`, `7d`.
 * @returns {number|null} window length in ms, or null if invalid / absent
 */
export function parseSinceQuery(value) {
  if (value == null || value === "") {
    return null;
  }
  const raw = String(value).trim().toLowerCase();
  const match = /^(\d+(?:\.\d+)?)(h|m|d)$/.exec(raw);
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  const unitMs = { m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * unitMs[match[2]];
}

export function formatSinceQuery(sinceMs) {
  if (sinceMs % 3_600_000 === 0) {
    return `${sinceMs / 3_600_000}h`;
  }
  if (sinceMs % 60_000 === 0) {
    return `${sinceMs / 60_000}m`;
  }
  return `${sinceMs}ms`;
}

/**
 * Donor JWT: neighbourhood feeds cap at the default window (2h); own-history
 * lists without near/locality scope may reach [getInitiatorHistorySinceMs].
 * Coordinators may pass `since` optionally; omit for full history.
 */
export function resolveListSinceMs(role, querySince, options = {}) {
  const parsed = parseSinceQuery(querySince);
  if (isCoordinatorApiRole(role)) {
    return parsed;
  }
  const neighbourhoodActive =
    options.neighbourhoodMode === "near" ||
    options.neighbourhoodMode === "locality";
  const maxMs = neighbourhoodActive
    ? getDonorListSinceMs()
    : getInitiatorHistorySinceMs();
  if (parsed == null) {
    return maxMs;
  }
  return Math.min(parsed, maxMs);
}

export function filterRecordsSince(records, sinceMs, nowMs = Date.now()) {
  if (sinceMs == null || sinceMs <= 0) {
    return records;
  }
  const cutoff = nowMs - sinceMs;
  return records.filter((record) => intentActivityMs(record) >= cutoff);
}
