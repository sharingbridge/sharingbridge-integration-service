const DEFAULT_MAX_ROWS = 100;
const MIN_ROWS = 1;
const MAX_ROWS = 500;

/**
 * @returns {number}
 */
export function getOrderIntentListMaxRows() {
  const raw = process.env.ORDER_INTENT_LIST_MAX_ROWS;
  if (raw == null || String(raw).trim() === "") {
    return DEFAULT_MAX_ROWS;
  }
  const parsed = Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MAX_ROWS;
  }
  return Math.min(MAX_ROWS, Math.max(MIN_ROWS, parsed));
}
