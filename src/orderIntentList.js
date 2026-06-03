/**
 * Dashboard list entry point — delegates to the store implementation.
 * Production: Postgres + PostGIS SQL (`PostgresOrderIntentStore.listForDashboard`).
 * Tests: file `OrderIntentStore.listForDashboard` (in-memory filters, no database).
 *
 * @param {{ listForDashboard: (opts: object) => Promise<object[]> | object[] }} store
 */
export async function listOrderIntentsForDashboard(store, opts) {
  if (typeof store.listForDashboard !== "function") {
    throw new Error(
      "orderIntentStore.listForDashboard is required (Postgres with PostGIS schema, or file store in tests)."
    );
  }
  return store.listForDashboard(opts);
}
