import {
  aggregateDemandByLocality,
  formatSeekerDemandForApi
} from "./seekerDemands.js";

/**
 * Phase C.1 — demand board from persisted seeker_demands (+ vendor bids later).
 */
export async function buildDemandBoardSnapshot({
  role,
  seekerDemandStore
} = {}) {
  const rows = seekerDemandStore
    ? await seekerDemandStore.listRecent({ limit: 100 })
    : [];
  const formatted = rows.map(formatSeekerDemandForApi);
  const windows = aggregateDemandByLocality(formatted);
  const schemaReady = seekerDemandStore?.enabled !== false;

  return {
    status: schemaReady ? "live_seeker_demands" : "schema_pending",
    role: role ?? null,
    message: schemaReady
      ? "Seeker demands recorded in the field. Vendor bidding is not live yet."
      : "Run schema-seeker-demands-migration.sql in Supabase to enable seeker demand recording.",
    standard_offers: [],
    demand_windows: windows,
    seeker_demands: formatted,
    pledges: [],
    vendor_bids: [],
    generated_at: new Date().toISOString()
  };
}
