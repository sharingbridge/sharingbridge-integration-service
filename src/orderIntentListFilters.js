import { filterRecordsByNeighbourhood } from "./neighbourhoodFilter.js";
import { filterRecordsSince } from "./sinceFilter.js";
import { sortOrderIntentsNewestFirst } from "./orderIntents.js";

/**
 * File-backed store only (unit tests). Production uses PostGIS SQL — see postgresOrderIntentStore.
 */
export function applyDashboardListFilters(records, opts) {
  let rows = sortOrderIntentsNewestFirst(records);
  if (opts.sinceMs != null && opts.sinceMs > 0) {
    rows = filterRecordsSince(rows, opts.sinceMs);
  }
  return filterRecordsByNeighbourhood(
    rows,
    opts.neighbourhoodScope ?? null,
    opts.viewerUserId ?? "",
    opts.role ?? ""
  );
}
