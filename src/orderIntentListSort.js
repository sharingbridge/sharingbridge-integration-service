/**
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
export function compareOrderIntentsByDistanceAsc(a, b) {
  const da = typeof a.distance_m === "number" ? a.distance_m : null;
  const db = typeof b.distance_m === "number" ? b.distance_m : null;
  if (da != null && db != null && da !== db) {
    return da - db;
  }
  if (da != null && db == null) {
    return -1;
  }
  if (da == null && db != null) {
    return 1;
  }
  const rightTime = Date.parse(b.updated_at || b.created_at || 0);
  const leftTime = Date.parse(a.updated_at || a.created_at || 0);
  return (
    (Number.isNaN(rightTime) ? 0 : rightTime) -
    (Number.isNaN(leftTime) ? 0 : leftTime)
  );
}
