import {
  aggregateDemandByLocality,
  formatSeekerDemandForApi
} from "./seekerDemands.js";

/**
 * Phase C.1 — demand board from persisted seeker_demands (+ vendor bids later).
 */
import {
  activeLocalityKeysFromSeekerDemands,
  enrichDemandWindowsWithSupply,
  formatPledgeForApi,
  formatVendorBidForApi,
  tagMarketplaceLocalityMatch
} from "./marketplace.js";

export async function resolveActiveLocalityKeys(seekerDemandStore) {
  if (!seekerDemandStore || seekerDemandStore.enabled === false) {
    return [];
  }
  const rows = await seekerDemandStore.listRecent({ limit: 100 });
  return activeLocalityKeysFromSeekerDemands(rows.map(formatSeekerDemandForApi));
}

export async function buildDemandBoardSnapshot({
  role,
  seekerDemandStore,
  marketplaceStore
} = {}) {
  const rows = seekerDemandStore
    ? await seekerDemandStore.listRecent({ limit: 100 })
    : [];
  const formatted = rows.map(formatSeekerDemandForApi);
  const schemaReady = seekerDemandStore?.enabled !== false;
  const activeLocalityKeys = activeLocalityKeysFromSeekerDemands(formatted);
  const pledgesRaw = marketplaceStore
    ? (await marketplaceStore.listPledges({ limit: 100 })).map(formatPledgeForApi)
    : [];
  const vendorBidsRaw = marketplaceStore
    ? (await marketplaceStore.listVendorBids({ limit: 100 })).map(
        formatVendorBidForApi
      )
    : [];
  const pledges = tagMarketplaceLocalityMatch(pledgesRaw, activeLocalityKeys);
  const vendorBids = tagMarketplaceLocalityMatch(
    vendorBidsRaw,
    activeLocalityKeys
  );
  const windows = enrichDemandWindowsWithSupply(
    aggregateDemandByLocality(formatted),
    pledgesRaw,
    vendorBidsRaw
  );
  const orphanPledges = pledges.filter((row) => !row.matches_demand_bucket);
  const orphanVendorBids = vendorBids.filter((row) => !row.matches_demand_bucket);
  const standardOffers = marketplaceStore
    ? await marketplaceStore.listStandardOffers()
    : [];
  const marketplaceLive = marketplaceStore?.enabled !== false;

  return {
    status: schemaReady ? "live_seeker_demands" : "schema_pending",
    role: role ?? null,
    message: schemaReady
      ? marketplaceLive
        ? "Seeker demands, pledges, and vendor bids persist in Postgres. Gaps and allocation hints are computed; auto-assign and donor notify are not live yet."
        : "Seeker demands recorded. Run schema-marketplace-migration.sql for pledges and vendor bids."
      : "Run schema-seeker-demands-migration.sql in Supabase to enable seeker demand recording.",
    standard_offers: standardOffers,
    demand_windows: windows,
    active_locality_keys: activeLocalityKeys,
    seeker_demands: formatted,
    pledges,
    vendor_bids: vendorBids,
    orphan_pledges: orphanPledges,
    orphan_vendor_bids: orphanVendorBids,
    generated_at: new Date().toISOString()
  };
}
