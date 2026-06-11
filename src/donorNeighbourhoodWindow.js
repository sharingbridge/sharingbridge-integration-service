import { readEnvWithLegacy } from "./envLegacy.js";

const DEFAULT_HOURS = 2;
const MIN_HOURS = 1;
const MAX_HOURS = 72;

/**
 * @param {string | number | undefined} raw
 * @returns {number} whole hours between MIN_HOURS and MAX_HOURS
 */
export function parseDonorNeighbourhoodWindowHours(raw) {
  const parsed = Number(String(raw ?? DEFAULT_HOURS).trim());
  if (!Number.isFinite(parsed)) {
    return DEFAULT_HOURS;
  }
  return Math.min(MAX_HOURS, Math.max(MIN_HOURS, Math.round(parsed)));
}

/** From `INITIATOR_NEIGHBOURHOOD_WINDOW_HOURS` or legacy `DONOR_NEIGHBOURHOOD_WINDOW_HOURS` (default 2). */
export function getDonorNeighbourhoodWindowHours() {
  return parseDonorNeighbourhoodWindowHours(
    readEnvWithLegacy(
      "INITIATOR_NEIGHBOURHOOD_WINDOW_HOURS",
      "DONOR_NEIGHBOURHOOD_WINDOW_HOURS"
    )
  );
}

export function getDonorNeighbourhoodWindowMs() {
  return getDonorNeighbourhoodWindowHours() * 60 * 60 * 1000;
}

export function getDonorNeighbourhoodSinceQuery() {
  return `${getDonorNeighbourhoodWindowHours()}h`;
}
