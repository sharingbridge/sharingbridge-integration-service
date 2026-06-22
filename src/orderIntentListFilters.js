import {
  filterRecordsByNeighbourhood,
  haversineDistanceM
} from "./neighbourhoodFilter.js";
import { getOrderIntentListMaxRows } from "./orderIntentListMaxRows.js";
import { compareOrderIntentsByDistanceAsc } from "./orderIntentListSort.js";
import { recordHasLocation } from "./orderIntentLocation.js";
import { filterRecordsSince } from "./sinceFilter.js";
import { sortOrderIntentsNewestFirst } from "./orderIntents.js";

/**
 * @param {object[]} records
 * @param {{ type: "near", nearLat: number, nearLng: number } | null} scope
 */
function attachDistanceMetres(records, scope) {
  if (scope?.type !== "near") {
    return records.map((record) => ({ ...record, distance_m: null }));
  }
  return records.map((record) => {
    if (!recordHasLocation(record)) {
      return { ...record, distance_m: null };
    }
    const distance_m = Math.round(
      haversineDistanceM(
        scope.nearLat,
        scope.nearLng,
        record.location_lat,
        record.location_lng
      )
    );
    return { ...record, distance_m };
  });
}

/**
 * File-backed store only (unit tests). Production uses geo SQL — see sqlOrderIntentStore.
 */
export function applyDashboardListFilters(records, opts) {
  let rows = sortOrderIntentsNewestFirst(records);
  if (opts.sinceMs != null && opts.sinceMs > 0) {
    rows = filterRecordsSince(rows, opts.sinceMs);
  }
  rows = filterRecordsByNeighbourhood(
    rows,
    opts.neighbourhoodScope ?? null,
    opts.viewerUserId ?? "",
    opts.role ?? ""
  );
  rows = attachDistanceMetres(rows, opts.neighbourhoodScope ?? null);
  if (opts.neighbourhoodScope?.type === "near") {
    rows = [...rows].sort(compareOrderIntentsByDistanceAsc);
  }
  const maxRows = opts.maxRows ?? getOrderIntentListMaxRows();
  return rows.slice(0, maxRows);
}
