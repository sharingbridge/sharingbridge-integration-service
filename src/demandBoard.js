import {
  aggregateDemandByLocality,
  formatSeekerDemandForApi
} from "./seekerDemands.js";

/**
 * Phase C.1 — demand board from persisted seeker_demands (+ vendor bids later).
 */
import {
  formatPledgeForApi,
  formatVendorBidForApi
} from "./marketplace.js";

export async function buildDemandBoardSnapshot({
  role,
  seekerDemandStore,
  marketplaceStore
} = {}) {
  const rows = seekerDemandStore
    ? await seekerDemandStore.listRecent({ limit: 100 })
    : [];
  const formatted = rows.map(formatSeekerDemandForApi);
  const windows = aggregateDemandByLocality(formatted);
  const schemaReady = seekerDemandStore?.enabled !== false;
  const pledges = marketplaceStore
    ? (await marketplaceStore.listPledges({ limit: 100 })).map(formatPledgeForApi)
    : [];
  const vendorBids = marketplaceStore
    ? (await marketplaceStore.listVendorBids({ limit: 100 })).map(
        formatVendorBidForApi
      )
    : [];
  const standardOffers = marketplaceStore
    ? await marketplaceStore.listStandardOffers()
    : [];
  const marketplaceLive = marketplaceStore?.enabled !== false;

  return {
    status: schemaReady ? "live_seeker_demands" : "schema_pending",
    role: role ?? null,
    message: schemaReady
      ? marketplaceLive
        ? "Seeker demands, pledges, and vendor bids on the demand board. Allocation engine is not live yet."
        : "Seeker demands recorded. Run schema-marketplace-migration.sql for pledges and vendor bids."
      : "Run schema-seeker-demands-migration.sql in Supabase to enable seeker demand recording.",
    standard_offers: standardOffers,
    demand_windows: windows,
    seeker_demands: formatted,
    pledges,
    vendor_bids: vendorBids,
    generated_at: new Date().toISOString()
  };
}
